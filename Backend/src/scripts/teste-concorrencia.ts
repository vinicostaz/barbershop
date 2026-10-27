// Teste de concorrência (RNF-006): vários clientes disputando o MESMO horário ao mesmo tempo.
//
//   npm run test:concorrencia
//
// Prova três coisas, contra o seu Postgres de verdade:
//   1) a exclusion constraint existe no banco e barra sobreposição (sem passar pela API);
//   2) pela API, só UM entre N clientes simultâneos consegue agendar o horário;
//   3) no reagendamento simultâneo, só um ganha E quem perde NÃO perde o horário original
//      (a transação desfaz o cancelamento).
//
// O script cria os próprios dados (barbeiro, serviço e clientes com e-mail conc-...@teste.local),
// e apaga tudo no final, mesmo que algum teste falhe. Não mexe nos seus dados reais.
// Roda o app dentro do próprio processo, então NÃO precisa deixar o servidor ligado.
import "dotenv/config";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "../app.js";
import { env } from "../config/env.js";
import { AppError } from "../middlewares/errorHandler.js";
import { ehConflitoDeHorario, traduzirErroDeConflito } from "../modules/agendamentos/agendamentos.horario.js";
import { agendamentosRepository } from "../modules/agendamentos/agendamentos.repository.js";
import { agoraComoHoraDeParede } from "../modules/agendamentos/agendamentos.tempo.js";
import { adicionarMinutos, combinarDataHora } from "../modules/agendamentos/agendamentos.utils.js";
import { db } from "../prisma/client.js";

if (process.env.NODE_ENV === "production") {
  console.error("Recusado: este teste cria e apaga dados e não deve rodar em produção.");
  process.exit(1);
}

// quantidade de clientes simultâneos (limitada pelo pool de conexões do banco, que é 10)
const N = Math.min(Math.max(Number(process.env.CONC_N ?? 8), 2), 9);
const RODADAS = Math.max(Number(process.env.CONC_RODADAS ?? 5), 1); // repetições do teste 2
const RUN = Date.now().toString(36);

const resultados: { nome: string; ok: boolean }[] = [];
function conferir(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${nome}${detalhe ? `  (${detalhe})` : ""}`);
  resultados.push({ nome, ok });
}

async function limparSobras() {
  const sobras = await db.usuario.findMany({
    where: { email: { startsWith: "conc-", endsWith: "@teste.local" } },
    select: { id: true },
  });
  const ids = sobras.map((u) => u.id);
  if (ids.length > 0) {
    await db.agendamento.deleteMany({ where: { OR: [{ barbeiroId: { in: ids } }, { clienteId: { in: ids } }] } });
    await db.notificacao.deleteMany({ where: { usuarioId: { in: ids } } });
    await db.filaDeEspera.deleteMany({ where: { OR: [{ barbeiroId: { in: ids } }, { clienteId: { in: ids } }] } });
    await db.disponibilidade.deleteMany({ where: { barbeiroId: { in: ids } } });
    await db.bloqueioPeriodo.deleteMany({ where: { barbeiroId: { in: ids } } });
    await db.usuario.deleteMany({ where: { id: { in: ids } } });
  }
  await db.servico.deleteMany({ where: { nome: { startsWith: "Teste Concorrência" } } });
}

async function chamar(base: string, metodo: string, caminho: string, token: string, corpo?: unknown) {
  const resposta = await fetch(base + caminho, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  let json: any = null;
  try {
    json = await resposta.json();
  } catch {
    // resposta sem corpo
  }
  return { status: resposta.status, corpo: json };
}

function hhmm(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

async function main() {
  await limparSobras();

  // uma data bem à frente, para nunca cair no "horário que já passou"
  const dia = agoraComoHoraDeParede();
  dia.setUTCDate(dia.getUTCDate() + 30);
  const DATA = dia.toISOString().slice(0, 10);

  const barbeiro = await db.usuario.create({
    data: { nome: "Barbeiro Teste Concorrência", email: `conc-${RUN}-barbeiro@teste.local`, senhaHash: "x", role: "BARBEIRO" },
  });
  const barbeiroAlternativo = await db.usuario.create({
    data: { nome: "Segundo Barbeiro Teste", email: `conc-${RUN}-barbeiro-2@teste.local`, senhaHash: "x", role: "BARBEIRO" },
  });
  const servico = await db.servico.create({
    data: { nome: `Teste Concorrência ${RUN}`, duracaoMin: 30, preco: 1 },
  });
  await db.disponibilidade.createMany({
    data: [barbeiro.id, barbeiroAlternativo.id].flatMap((barbeiroId) =>
      [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
        barbeiroId, diaSemana, horaInicio: "00:00", horaFim: "23:59",
      }))
    ),
  });
  const clientes: { id: string }[] = [];
  for (let i = 1; i <= N; i++) {
    clientes.push(
      await db.usuario.create({
        data: { nome: `Cliente Concorrência ${i}`, email: `conc-${RUN}-c${i}@teste.local`, senhaHash: "x", role: "CLIENTE" },
      })
    );
  }
  const tokens = clientes.map((c) => jwt.sign({ sub: c.id, role: "CLIENTE" }, env.jwtSecret, { expiresIn: "10m" }));
  const administrador = await db.usuario.create({
    data: {
      nome: "Administrador Teste Concorrência",
      email: `conc-${RUN}-admin@teste.local`,
      senhaHash: "x",
      role: "ADMINISTRADOR",
    },
  });
  const tokenAdministrador = jwt.sign(
    { sub: administrador.id, role: "ADMINISTRADOR" },
    env.jwtSecret,
    { expiresIn: "10m" }
  );

  const servidor = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => servidor.once("listening", () => r()));
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  const limparAgenda = () =>
    db.agendamento.deleteMany({
      where: { barbeiroId: { in: [barbeiro.id, barbeiroAlternativo.id] } },
    });

  try {
    console.log(`\n${N} clientes simultâneos | data de teste ${DATA}\n`);

    console.log("== Perfis e privacidade das respostas ==");
    const publico = await fetch(`${base}/barbeiros/${barbeiro.id}`);
    const barbeiroPublico = (await publico.json()) as Record<string, unknown>;
    conferir(
      "resposta pública do barbeiro não expõe campos privados",
      publico.status === 200 &&
        !("senhaHash" in barbeiroPublico) &&
        !("email" in barbeiroPublico) &&
        !("telefone" in barbeiroPublico)
    );
    const novoAdminEmail = `conc-${RUN}-admin-criado@teste.local`;
    const adminCriado = await chamar(base, "POST", "/auth/usuarios", tokenAdministrador, {
      nome: "Administrador Criado no Teste",
      email: novoAdminEmail,
      senha: "123456",
      role: "ADMINISTRADOR",
    });
    conferir(
      "administrador consegue criar outro administrador sem receber senhaHash",
      adminCriado.status === 201 &&
        adminCriado.corpo?.role === "ADMINISTRADOR" &&
        !("senhaHash" in (adminCriado.corpo ?? {}))
    );
    const clienteTentandoCriarAdmin = await chamar(base, "POST", "/auth/usuarios", tokens[0], {
      nome: "Não autorizado",
      email: `conc-${RUN}-negado@teste.local`,
      senha: "123456",
      role: "ADMINISTRADOR",
    });
    conferir(
      "cliente não consegue criar usuários privilegiados",
      clienteTentandoCriarAdmin.status === 403
    );
    const tokenBarbeiro = jwt.sign(
      { sub: barbeiro.id, role: "BARBEIRO" },
      env.jwtSecret,
      { expiresIn: "10m" }
    );
    await db.usuario.update({ where: { id: barbeiro.id }, data: { ativo: false } });
    const acessoComTokenAntigo = await chamar(base, "GET", "/agendamentos", tokenBarbeiro);
    const barbeirosAtivosResposta = await fetch(`${base}/barbeiros`);
    const barbeirosAtivos = (await barbeirosAtivosResposta.json()) as Array<{ id: string }>;
    conferir(
      "barbeiro desativado some da listagem pública",
      !barbeirosAtivos.some((item) => item.id === barbeiro.id)
    );
    conferir(
      "token emitido antes da desativação deixa de acessar a API",
      acessoComTokenAntigo.status === 401
    );
    await db.usuario.update({ where: { id: barbeiro.id }, data: { ativo: true } });

    console.log("== Disponibilidade pública considera duração, agendamentos e bloqueios? ==");
    const ocupadoInicio = combinarDataHora(DATA, "10:00");
    await db.agendamento.create({
      data: {
        clienteId: clientes[0].id,
        barbeiroId: barbeiro.id,
        servicoId: servico.id,
        data: ocupadoInicio,
        horaInicio: ocupadoInicio,
        horaFim: adicionarMinutos(ocupadoInicio, 30),
      },
    });
    await db.bloqueioPeriodo.create({
      data: {
        barbeiroId: barbeiro.id,
        inicio: combinarDataHora(DATA, "11:00"),
        fim: combinarDataHora(DATA, "12:00"),
        motivo: "Teste automatizado",
      },
    });
    const horariosResposta = await fetch(
      `${base}/disponibilidades/barbeiros/${barbeiro.id}/horarios?data=${DATA}&servicoId=${servico.id}`
    );
    const horarios = (await horariosResposta.json()) as string[];
    conferir("consulta de horários disponíveis responde 200", horariosResposta.status === 200);
    conferir(
      "horários sobrepostos ao atendimento inteiro não aparecem",
      !["09:45", "10:00", "10:15"].some((hora) => horarios.includes(hora))
    );
    conferir(
      "horários sobrepostos ao bloqueio não aparecem",
      !["10:45", "11:00", "11:15", "11:30", "11:45"].some((hora) => horarios.includes(hora))
    );
    conferir(
      "horários livres antes e depois dos impedimentos continuam disponíveis",
      horarios.includes("09:30") && horarios.includes("12:00")
    );
    const datasResposta = await fetch(
      `${base}/disponibilidades/barbeiros/${barbeiro.id}/datas?servicoId=${servico.id}&limite=31`
    );
    const datas = (await datasResposta.json()) as string[];
    conferir(
      "consulta de datas devolve somente dias que possuem algum horário livre",
      datasResposta.status === 200 && datas.includes(DATA)
    );
    await db.bloqueioPeriodo.create({
      data: {
        barbeiroId: barbeiro.id,
        inicio: combinarDataHora(DATA, "00:00"),
        fim: adicionarMinutos(combinarDataHora(DATA, "00:00"), 24 * 60),
        motivo: "Dia inteiro bloqueado no teste automatizado",
      },
    });
    const datasAposBloqueioResposta = await fetch(
      `${base}/disponibilidades/barbeiros/${barbeiro.id}/datas?servicoId=${servico.id}&limite=31`
    );
    const datasAposBloqueio = (await datasAposBloqueioResposta.json()) as string[];
    conferir(
      "dia sem nenhum horário livre não aparece como disponível",
      datasAposBloqueioResposta.status === 200 && !datasAposBloqueio.includes(DATA)
    );
    await limparAgenda();
    await db.bloqueioPeriodo.deleteMany({ where: { barbeiroId: barbeiro.id } });

    console.log("== Cliente não pode ocupar dois profissionais ao mesmo tempo ==");
    const inicioCliente = combinarDataHora(DATA, "16:00");
    await db.agendamento.create({
      data: {
        clienteId: clientes[0].id,
        barbeiroId: barbeiro.id,
        servicoId: servico.id,
        data: inicioCliente,
        horaInicio: inicioCliente,
        horaFim: adicionarMinutos(inicioCliente, 30),
      },
    });
    const criacaoSobreposta = await chamar(base, "POST", "/agendamentos", tokens[0], {
      barbeiroId: barbeiroAlternativo.id,
      servicoId: servico.id,
      data: DATA,
      horaInicio: "16:15",
    });
    conferir(
      "criação com outro barbeiro é recusada quando o cliente já está ocupado",
      criacaoSobreposta.status === 409 &&
        String(criacaoSobreposta.corpo?.error).includes("outro agendamento")
    );

    const inicioOriginal = combinarDataHora(DATA, "18:00");
    const originalAlternativo = await db.agendamento.create({
      data: {
        clienteId: clientes[0].id,
        barbeiroId: barbeiroAlternativo.id,
        servicoId: servico.id,
        data: inicioOriginal,
        horaInicio: inicioOriginal,
        horaFim: adicionarMinutos(inicioOriginal, 30),
      },
    });
    const reagendamentoSobreposto = await chamar(
      base,
      "PATCH",
      `/agendamentos/${originalAlternativo.id}/reagendar`,
      tokens[0],
      { data: DATA, horaInicio: "16:15" }
    );
    conferir(
      "reagendamento com outro barbeiro é recusado quando o cliente já está ocupado",
      reagendamentoSobreposto.status === 409 &&
        String(reagendamentoSobreposto.corpo?.error).includes("outro agendamento")
    );
    const originalPreservado = await db.agendamento.findUnique({
      where: { id: originalAlternativo.id },
      select: { status: true, horaInicio: true },
    });
    conferir(
      "reagendamento recusado preserva o atendimento original",
      originalPreservado?.status === "CONFIRMADO" &&
        originalPreservado.horaInicio.getTime() === inicioOriginal.getTime()
    );
    await limparAgenda();

    const tentativasMesmoCliente = await Promise.all([
      chamar(base, "POST", "/agendamentos", tokens[0], {
        barbeiroId: barbeiro.id,
        servicoId: servico.id,
        data: DATA,
        horaInicio: "17:00",
      }),
      chamar(base, "POST", "/agendamentos", tokens[0], {
        barbeiroId: barbeiroAlternativo.id,
        servicoId: servico.id,
        data: DATA,
        horaInicio: "17:00",
      }),
    ]);
    conferir(
      "duas requisições simultâneas do mesmo cliente têm somente um vencedor",
      tentativasMesmoCliente.filter((resposta) => resposta.status === 201).length === 1
    );
    conferir(
      "a requisição simultânea perdedora recebe conflito",
      tentativasMesmoCliente.filter((resposta) => resposta.status === 409).length === 1
    );
    const confirmadosMesmoCliente = await db.agendamento.count({
      where: { clienteId: clientes[0].id, status: "CONFIRMADO" },
    });
    conferir(
      "o banco mantém somente um horário confirmado para o cliente",
      confirmadosMesmoCliente === 1
    );
    await limparAgenda();

    console.log("== 0) A exclusion constraint existe neste banco? ==");
    const [{ existe }] = await db.$queryRaw<{ existe: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sem_conflito_horario') AS existe`;
    conferir("constraint sem_conflito_horario está aplicada", existe === true,
      existe ? "" : "rode: npx prisma migrate deploy");

    console.log("\n== 1) Direto no banco (sem passar pela API): N inserts sobrepostos ao mesmo tempo ==");
    const ini1 = combinarDataHora(DATA, "10:00");
    const fim1 = adicionarMinutos(ini1, 30);
    const tentativas = await Promise.allSettled(
      clientes.map((c) =>
        db.agendamento.create({
          data: { clienteId: c.id, barbeiroId: barbeiro.id, servicoId: servico.id, data: ini1, horaInicio: ini1, horaFim: fim1 },
        })
      )
    );
    const aceitas = tentativas.filter((t) => t.status === "fulfilled").length;
    const recusadas = tentativas.filter((t): t is PromiseRejectedResult => t.status === "rejected");
    conferir("só 1 insert é aceito pelo banco", aceitas === 1, `${aceitas} de ${N}`);
    conferir("todas as outras são recusadas por conflito de horário", recusadas.length === N - 1 && recusadas.every((r) => ehConflitoDeHorario(r.reason)),
      `${recusadas.filter((r) => ehConflitoDeHorario(r.reason)).length} reconhecidas de ${recusadas.length}`);
    if (recusadas[0]) {
      const e = recusadas[0].reason as { code?: string; message?: string };
      console.log(`   erro de exemplo -> code: ${e.code} | ${String(e.message).trim().split("\n").slice(-1)[0].slice(0, 160)}`);
    }

    console.log("\n== 1b) O erro REAL do banco é traduzido para 409 pela aplicação ==");
    const clienteParaConflitoBanco = await db.usuario.create({
      data: {
        nome: "Cliente Teste Constraint",
        email: `conc-${RUN}-constraint@teste.local`,
        senhaHash: "x",
        role: "CLIENTE",
      },
    });
    try {
      await agendamentosRepository
        .create({ clienteId: clienteParaConflitoBanco.id, barbeiroId: barbeiro.id, servicoId: servico.id, data: ini1, horaInicio: ini1, horaFim: fim1 })
        .catch((e: unknown) => traduzirErroDeConflito(e));
      conferir("conflito vindo do banco vira 409 com mensagem amigável", false, "o insert não falhou");
    } catch (e) {
      conferir("conflito vindo do banco vira 409 com mensagem amigável",
        e instanceof AppError && e.statusCode === 409 && e.message.includes("acabou de ser preenchido"),
        e instanceof AppError ? `${e.statusCode} "${e.message}"` : `erro sem tradução: ${String(e).slice(0, 120)}`);
    }
    await limparAgenda();

    console.log(`\n== 2) Pela API: ${N} clientes tentam agendar o MESMO horário ao mesmo tempo (${RODADAS} rodadas) ==`);
    let totalPeloBanco = 0;
    let totalPelaChecagem = 0;
    const rodadasRuins: string[] = [];
    for (let rodada = 0; rodada < RODADAS; rodada++) {
      const horaRodada = hhmm(11 * 60 + 60 * rodada); // 11:00, 12:00, 13:00...
      const r2 = await Promise.all(
        tokens.map((t) =>
          chamar(base, "POST", "/agendamentos", t, { barbeiroId: barbeiro.id, servicoId: servico.id, data: DATA, horaInicio: horaRodada })
        )
      );
      const criados = r2.filter((r) => r.status === 201).length;
      const conflitos = r2.filter((r) => r.status === 409);
      const inesperadas = r2.filter((r) => r.status !== 201 && r.status !== 409);
      const confirmados = await db.agendamento.count({
        where: { barbeiroId: barbeiro.id, status: "CONFIRMADO", horaInicio: combinarDataHora(DATA, horaRodada) },
      });
      totalPelaChecagem += conflitos.filter((r) => String(r.corpo?.error).includes("já está ocupado")).length;
      totalPeloBanco += conflitos.filter((r) => String(r.corpo?.error).includes("acabou de ser preenchido")).length;
      if (criados !== 1 || conflitos.length !== N - 1 || inesperadas.length > 0 || confirmados !== 1) {
        rodadasRuins.push(`rodada ${rodada + 1}: ${criados} criados, ${conflitos.length} x 409, ${confirmados} no banco` +
          (inesperadas.length ? `, inesperadas: ${inesperadas.map((r) => `${r.status} ${JSON.stringify(r.corpo)}`).join(" ; ")}` : ""));
      }
      await limparAgenda();
    }
    conferir(`em ${RODADAS} rodadas: sempre exatamente 1 vencedor (201), ${N - 1} recusas (409) e 1 agendamento no banco`,
      rodadasRuins.length === 0, rodadasRuins.join(" | "));
    console.log(`   info: no total, ${totalPeloBanco} recusas vieram da constraint do banco (corrida real) e ${totalPelaChecagem} da checagem rápida da aplicação`);

    console.log("\n== 3) Pela API: N clientes REAGENDAM para o MESMO horário ao mesmo tempo ==");
    const originais: { id: string }[] = [];
    for (let i = 0; i < N; i++) {
      const ini = combinarDataHora(DATA, hhmm(9 * 60 + 30 * i)); // cada um começa num horário diferente
      originais.push(
        await db.agendamento.create({
          data: { clienteId: clientes[i].id, barbeiroId: barbeiro.id, servicoId: servico.id, data: ini, horaInicio: ini, horaFim: adicionarMinutos(ini, 30) },
        })
      );
    }
    const r3 = await Promise.all(
      tokens.map((t, i) => chamar(base, "PATCH", `/agendamentos/${originais[i].id}/reagendar`, t, { data: DATA, horaInicio: "15:00" }))
    );
    const aceitos = r3.filter((r) => r.status === 200);
    const conflitos3 = r3.filter((r) => r.status === 409);
    const inesperadas3 = r3.filter((r) => r.status !== 200 && r.status !== 409);
    conferir("exatamente 1 reagendamento é aceito (200)", aceitos.length === 1, `${aceitos.length} de ${N}`);
    conferir(`os outros ${N - 1} recebem 409`, conflitos3.length === N - 1, `${conflitos3.length}`);
    conferir("nenhuma resposta inesperada (500 etc.)", inesperadas3.length === 0,
      inesperadas3.map((r) => `${r.status} ${JSON.stringify(r.corpo)}`).join(" ; "));
    console.log(`   info: ${conflitos3.filter((r) => String(r.corpo?.error).includes("acabou de ser preenchido")).length} recusas vieram da constraint (e a transação desfez) e ${conflitos3.filter((r) => String(r.corpo?.error).includes("já está ocupado")).length} da checagem rápida`);
    const noAlvo = await db.agendamento.count({
      where: { barbeiroId: barbeiro.id, status: "CONFIRMADO", horaInicio: combinarDataHora(DATA, "15:00") },
    });
    conferir("só 1 agendamento CONFIRMADO às 15:00", noAlvo === 1, `${noAlvo}`);
    const porCliente = await Promise.all(clientes.map((c) => db.agendamento.count({ where: { clienteId: c.id, status: "CONFIRMADO" } })));
    conferir("todo cliente continua com exatamente 1 agendamento confirmado (quem perdeu manteve o original)",
      porCliente.every((n) => n === 1), `contagens: ${porCliente.join(",")}`);
    const reagendados = await db.agendamento.count({ where: { barbeiroId: barbeiro.id, status: "REAGENDADO" } });
    conferir("só o vencedor teve o horário antigo marcado como reagendado", reagendados === 1, `${reagendados}`);
  } finally {
    servidor.close();
    await limparSobras();
  }
}

main()
  .catch((err) => {
    console.error("\nO teste quebrou antes de terminar:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    const falhas = resultados.filter((r) => !r.ok);
    console.log(`\n${resultados.length - falhas.length}/${resultados.length} verificações passaram.`);
    if (falhas.length > 0) {
      console.log("FALHARAM:\n - " + falhas.map((f) => f.nome).join("\n - "));
      process.exitCode = 1;
    }
  });
