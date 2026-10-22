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
  const servico = await db.servico.create({
    data: { nome: `Teste Concorrência ${RUN}`, duracaoMin: 30, preco: 1 },
  });
  await db.disponibilidade.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
      barbeiroId: barbeiro.id, diaSemana, horaInicio: "00:00", horaFim: "23:59",
    })),
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

  const servidor = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => servidor.once("listening", () => r()));
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  const limparAgenda = () => db.agendamento.deleteMany({ where: { barbeiroId: barbeiro.id } });

  try {
    console.log(`\n${N} clientes simultâneos | data de teste ${DATA}\n`);

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
    try {
      await agendamentosRepository
        .create({ clienteId: clientes[0].id, barbeiroId: barbeiro.id, servicoId: servico.id, data: ini1, horaInicio: ini1, horaFim: fim1 })
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
    const cancelados = await db.agendamento.count({ where: { barbeiroId: barbeiro.id, status: "CANCELADO" } });
    conferir("só o vencedor teve o horário antigo cancelado", cancelados === 1, `${cancelados}`);
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
