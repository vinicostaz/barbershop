// Testes da fila de espera voltada ao cliente:
//   - GET /fila-de-espera/horarios-elegiveis
//   - GET /fila-de-espera (posição, pessoasNaFrente, expiraEm, podeConfirmar)
//   - DELETE /fila-de-espera/:id (desistir)
//   - entradas simultâneas
//
//   npm run test:fila
//
// Roda contra o seu Postgres de verdade. Cria os próprios dados (barbeiro, serviço e clientes com
// e-mail fila-...@teste.local) e apaga tudo no final, mesmo que um teste falhe.
// Roda o app dentro do próprio processo, então NÃO precisa deixar o servidor ligado.
import "dotenv/config";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "../app.js";
import { env } from "../config/env.js";
import { agoraComoHoraDeParede } from "../modules/agendamentos/agendamentos.tempo.js";
import { adicionarMinutos, combinarDataHora } from "../modules/agendamentos/agendamentos.utils.js";
import { db } from "../prisma/client.js";

if (process.env.NODE_ENV === "production") {
  console.error("Recusado: este teste cria e apaga dados e não deve rodar em produção.");
  process.exit(1);
}

const RUN = Date.now().toString(36);
const DURACAO = 45; // minutos: ajuda a provar que a duração inteira do serviço é considerada

const resultados: { nome: string; ok: boolean }[] = [];
function conferir(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${nome}${detalhe ? `  (${detalhe})` : ""}`);
  resultados.push({ nome, ok });
}

async function limparSobras() {
  const sobras = await db.usuario.findMany({
    where: { email: { startsWith: "fila-", endsWith: "@teste.local" } },
    select: { id: true },
  });
  const ids = sobras.map((u) => u.id);
  if (ids.length > 0) {
    await db.notificacao.deleteMany({ where: { usuarioId: { in: ids } } });
    await db.filaDeEspera.deleteMany({ where: { OR: [{ barbeiroId: { in: ids } }, { clienteId: { in: ids } }] } });
    await db.agendamento.deleteMany({ where: { OR: [{ barbeiroId: { in: ids } }, { clienteId: { in: ids } }] } });
    await db.disponibilidade.deleteMany({ where: { barbeiroId: { in: ids } } });
    await db.bloqueioPeriodo.deleteMany({ where: { barbeiroId: { in: ids } } });
    await db.usuario.deleteMany({ where: { id: { in: ids } } });
  }
  await db.servico.deleteMany({ where: { nome: { startsWith: "Teste Fila" } } });
}

const hm = (d: Date) => d.toISOString().slice(11, 16);
const diaMais = (n: number) => {
  const d = agoraComoHoraDeParede();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function main() {
  await limparSobras();

  const barbeiro = await db.usuario.create({
    data: { nome: "Barbeiro Teste Fila", email: `fila-${RUN}-barbeiro@teste.local`, senhaHash: "x", role: "BARBEIRO" },
  });
  const servico = await db.servico.create({ data: { nome: `Teste Fila ${RUN}`, duracaoMin: DURACAO, preco: 1 } });
  await db.disponibilidade.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({ barbeiroId: barbeiro.id, diaSemana, horaInicio: "09:00", horaFim: "18:00" })),
  });
  const criarCliente = (n: number) =>
    db.usuario.create({ data: { nome: `Cliente Fila ${n}`, email: `fila-${RUN}-c${n}@teste.local`, senhaHash: "x", role: "CLIENTE" } });
  const [c1, c2, c3, c4] = [await criarCliente(1), await criarCliente(2), await criarCliente(3), await criarCliente(4)];
  const tk = (id: string, role: string) => jwt.sign({ sub: id, role }, env.jwtSecret, { expiresIn: "10m" });
  const T = { c1: tk(c1.id, "CLIENTE"), c2: tk(c2.id, "CLIENTE"), c3: tk(c3.id, "CLIENTE"), c4: tk(c4.id, "CLIENTE"), bar: tk(barbeiro.id, "BARBEIRO") };

  const servidor = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => servidor.once("listening", () => r()));
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  async function api(metodo: string, caminho: string, token: string, corpo?: unknown) {
    const r = await fetch(base + caminho, {
      method: metodo,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    let json: any = null;
    try { json = JSON.parse(texto); } catch { /* sem corpo */ }
    return { status: r.status, json, texto };
  }
  const elegiveis = (token: string, data: string, extra = "") =>
    api("GET", `/fila-de-espera/horarios-elegiveis?barbeiroId=${barbeiro.id}&servicoId=${servico.id}&data=${data}${extra}`, token);
  const entrar = (token: string, data: string, hora: string) =>
    api("POST", "/fila-de-espera", token, { barbeiroId: barbeiro.id, servicoId: servico.id, data, horaInicio: hora });
  const minhas = async (token: string) => (await api("GET", "/fila-de-espera", token)).json as any[];
  const ocupar = (clienteId: string, data: string, ini: string, fim: string) =>
    db.agendamento.create({
      data: { clienteId, barbeiroId: barbeiro.id, servicoId: servico.id, data: combinarDataHora(data, "00:00"), horaInicio: combinarDataHora(data, ini), horaFim: combinarDataHora(data, fim) },
    });
  const lista = (r: { json: any }) => (r.json as { horaInicio: string }[]).map((x) => x.horaInicio);

  try {
    const [D1, D2, D3, D4, D5, D6] = [30, 31, 32, 33, 34, 35].map(diaMais);
    console.log(`\nserviço de ${DURACAO} min | disponibilidade 09:00-18:00 | datas de teste ${D1} a ${D6}\n`);

    console.log("== horários elegíveis ==");
    const ag1 = await ocupar(c1.id, D1, "14:00", "14:45");
    const e1 = await elegiveis(T.c2, D1);
    ok(e1.status === 200, e1.status);
    conferir("só horários OCUPADOS são elegíveis: de 13:30 a 14:30, de 15 em 15 min (os que tocam o das 14:00-14:45)",
      JSON.stringify(lista(e1)) === JSON.stringify(["13:30", "13:45", "14:00", "14:15", "14:30"]), lista(e1).join(","));
    const i1400 = e1.json.find((x: any) => x.horaInicio === "14:00");
    conferir("considera a duração inteira do serviço (14:00 termina às 14:45)", i1400?.horaFim === "14:45" && i1400?.data === D1, JSON.stringify(i1400));
    conferir("horário livre (10:00) não é elegível", !lista(e1).includes("10:00"));
    conferir("a resposta só tem data/horaInicio/horaFim: nenhum dado de quem ocupa o horário",
      e1.json.every((x: any) => Object.keys(x).sort().join() === "data,horaFim,horaInicio") &&
        ![c1.id, c1.email, c1.nome].some((v) => e1.texto.includes(v)));

    await ocupar(c1.id, D2, "11:00", "11:45");
    await db.bloqueioPeriodo.create({ data: { barbeiroId: barbeiro.id, inicio: combinarDataHora(D2, "11:30"), fim: combinarDataHora(D2, "12:30") } });
    const e2 = await elegiveis(T.c2, D2);
    conferir("horário dentro de bloqueio não é elegível (sobram 10:30 e 10:45, que terminam antes do bloqueio)", JSON.stringify(lista(e2)) === JSON.stringify(["10:30", "10:45"]), lista(e2).join(","));

    await ocupar(c1.id, D3, "15:00", "15:45");
    const reserva = await db.filaDeEspera.create({ data: { clienteId: c3.id, barbeiroId: barbeiro.id, servicoId: servico.id, status: "NOTIFICADO",
      horaInicio: combinarDataHora(D3, "15:00"), horaFim: combinarDataHora(D3, "15:45"), expiraEm: new Date(Date.now() + 10 * 60_000) } });
    conferir("horário com prioridade ativa de outra pessoa não é elegível", lista(await elegiveis(T.c2, D3)).length === 0);
    await db.filaDeEspera.update({ where: { id: reserva.id }, data: { expiraEm: new Date(Date.now() - 60_000) } });
    conferir("prioridade vencida: os horários voltam a ser elegíveis", JSON.stringify(lista(await elegiveis(T.c2, D3))) === JSON.stringify(["14:30", "14:45", "15:00", "15:15", "15:30"]));

    conferir("data no passado => lista vazia", lista(await elegiveis(T.c2, "2020-01-06")).length === 0);
    // "hoje" só prova algo se houver horários ocupados e disponíveis em volta do "agora", e isso depende
    // da hora em que o teste roda. Por isso: barbeiro próprio com agenda 24h e um agendamento montado
    // de 30 min ANTES de agora até 45 min DEPOIS.
    const barbeiroHoje = await db.usuario.create({
      data: { nome: "Barbeiro Teste Fila Hoje", email: `fila-${RUN}-hoje@teste.local`, senhaHash: "x", role: "BARBEIRO" },
    });
    await db.disponibilidade.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({ barbeiroId: barbeiroHoje.id, diaSemana, horaInicio: "00:00", horaFim: "23:59" })),
    });
    const agoraP = agoraComoHoraDeParede();
    agoraP.setUTCSeconds(0, 0);
    await db.agendamento.create({
      data: { clienteId: c1.id, barbeiroId: barbeiroHoje.id, servicoId: servico.id, data: combinarDataHora(agoraP.toISOString().slice(0, 10), "00:00"),
        horaInicio: adicionarMinutos(agoraP, -30), horaFim: adicionarMinutos(agoraP, 45) },
    });
    const hojeResp = await api("GET",
      `/fila-de-espera/horarios-elegiveis?barbeiroId=${barbeiroHoje.id}&servicoId=${servico.id}&data=${agoraP.toISOString().slice(0, 10)}`, T.c2);
    const hojeLista = lista(hojeResp);
    const minutosAgora = agoraP.getUTCHours() * 60 + agoraP.getUTCMinutes();
    const doisDig = (n: number) => String(n).padStart(2, "0");
    const anterior = Math.floor(minutosAgora / 15) * 15; // horário da grade que começou antes (ou junto) de agora
    conferir(`hoje (agora ${hm(agoraP)}): todo horário oferecido começa a partir de agora`,
      hojeResp.status === 200 && hojeLista.every((h) => h >= hm(agoraP)), hojeLista.join(",") || "nenhum");
    conferir("hoje: o horário que já começou e ainda toca o agendamento NÃO é oferecido",
      anterior === minutosAgora || !hojeLista.includes(`${doisDig(Math.floor(anterior / 60))}:${doisDig(anterior % 60)}`),
      `grade anterior ${doisDig(Math.floor(anterior / 60))}:${doisDig(anterior % 60)}`);
    conferir("hoje: existe pelo menos um horário futuro elegível (a lista não está vazia à toa)",
      hojeLista.length >= 1 || minutosAgora >= 23 * 60 + 45, `${hojeLista.length} item(ns)`);

    // dentro da disponibilidade (09:00-18:00): o que começa antes ou estoura o expediente não é elegível
    const D7 = diaMais(36);
    await ocupar(c1.id, D7, "08:30", "09:15");
    await ocupar(c1.id, D7, "17:30", "18:15");
    conferir("só entram horários DENTRO da disponibilidade: 08:30 (antes do expediente) e 17:30 (estoura as 18:00) ficam de fora",
      JSON.stringify(lista(await elegiveis(T.c2, D7))) === JSON.stringify(["09:00", "17:00", "17:15"]), lista(await elegiveis(T.c2, D7)).join(","));

    // Coerência com a rota de horários livres (a da dupla): mesma grade, e nenhum horário nas duas listas
    const D8 = diaMais(37);
    const livresRota = (data: string) =>
      api("GET", `/disponibilidades/barbeiros/${barbeiro.id}/horarios?data=${data}&servicoId=${servico.id}`, T.c2);
    const livresAntes = (await livresRota(D8)).json as string[];
    await ocupar(c1.id, D8, "10:00", "10:45");
    const elegiveisD8 = lista(await elegiveis(T.c2, D8));
    const livresDepois = (await livresRota(D8)).json as string[];
    conferir("a rota de horários livres e a de elegíveis usam a mesma grade (todo elegível estava na lista de livres antes)",
      elegiveisD8.length > 0 && elegiveisD8.every((h) => livresAntes.includes(h)), `${elegiveisD8.join(",")}`);
    conferir("um horário nunca aparece nas duas listas (os elegíveis saem dos livres quando o horário é ocupado)",
      elegiveisD8.every((h) => !livresDepois.includes(h)));


    await ocupar(c2.id, D4, "09:00", "09:45"); // agendamento do próprio cliente 2
    await ocupar(c1.id, D4, "09:45", "10:30"); // outro cliente, colado no anterior
    conferir("conflito do próprio cliente: o que bate com o agendamento dele (09:00) sai; sobram 09:45, 10:00 e 10:15",
      JSON.stringify(lista(await elegiveis(T.c2, D4))) === JSON.stringify(["09:45", "10:00", "10:15"]), lista(await elegiveis(T.c2, D4)).join(","));
    conferir("mesmo dia para quem não tem agendamento: de 09:00 a 10:15", JSON.stringify(lista(await elegiveis(T.c3, D4))) === JSON.stringify(["09:00", "09:15", "09:30", "09:45", "10:00", "10:15"]));

    conferir("só cliente consulta: barbeiro recebe 403", (await elegiveis(T.bar, D1)).status === 403);
    const semParam = (qs: string) => api("GET", `/fila-de-espera/horarios-elegiveis?${qs}`, T.c2);
    conferir("parâmetros ausentes ou inválidos => 400",
      (await semParam(`servicoId=${servico.id}&data=${D1}`)).status === 400 &&
      (await semParam(`barbeiroId=${barbeiro.id}&data=${D1}`)).status === 400 &&
      (await semParam(`barbeiroId=${barbeiro.id}&servicoId=${servico.id}`)).status === 400 &&
      (await semParam(`barbeiroId=${barbeiro.id}&servicoId=${servico.id}&data=2026-13-45`)).status === 400 &&
      (await semParam(`barbeiroId=abc&servicoId=${servico.id}&data=${D1}`)).status === 400);
    conferir("barbeiro e serviço inexistentes => 404",
      (await api("GET", `/fila-de-espera/horarios-elegiveis?barbeiroId=00000000-0000-4000-8000-000000000000&servicoId=${servico.id}&data=${D1}`, T.c2)).status === 404 &&
      (await api("GET", `/fila-de-espera/horarios-elegiveis?barbeiroId=${barbeiro.id}&servicoId=00000000-0000-4000-8000-000000000000&data=${D1}`, T.c2)).status === 404);
    await db.usuario.update({ where: { id: barbeiro.id }, data: { ativo: false } });
    conferir("barbeiro desativado => 404", (await elegiveis(T.c2, D1)).status === 404);
    await db.usuario.update({ where: { id: barbeiro.id }, data: { ativo: true } });

    console.log("\n== entrar na fila continua validando ==");
    conferir("horário livre => 400 (não entra na fila)", (await entrar(T.c2, D1, "10:00")).status === 400);
    const f2 = await entrar(T.c2, D1, "14:00");
    conferir("horário ocupado => 201", f2.status === 201 && f2.json.status === "AGUARDANDO", `${f2.status}`);
    conferir("depois de entrar, só esse horário (14:00) sai da lista do próprio cliente; os vizinhos ficam",
      JSON.stringify(lista(await elegiveis(T.c2, D1))) === JSON.stringify(["13:30", "13:45", "14:15", "14:30"]), lista(await elegiveis(T.c2, D1)).join(","));
    conferir("entrar de novo no mesmo horário => 409", (await entrar(T.c2, D1, "14:00")).status === 409);

    console.log("\n== GET /fila-de-espera: posição, prazo e podeConfirmar ==");
    const f3 = await entrar(T.c3, D1, "14:00");
    const f4 = await entrar(T.c4, D1, "14:00");
    const pegar = async (token: string, id: string) => (await minhas(token)).find((e) => e.id === id);
    const m2 = await pegar(T.c2, f2.json.id), m3 = await pegar(T.c3, f3.json.id), m4 = await pegar(T.c4, f4.json.id);
    conferir("posições 1, 2 e 3 (pessoasNaFrente 0, 1 e 2)",
      [m2, m3, m4].map((m) => `${m.posicao}/${m.pessoasNaFrente}`).join(" ") === "1/0 2/1 3/2", [m2, m3, m4].map((m) => `${m.posicao}/${m.pessoasNaFrente}`).join(" "));
    conferir("AGUARDANDO: expiraEm null e podeConfirmar false", m2.status === "AGUARDANDO" && m2.expiraEm === null && m2.podeConfirmar === false);
    conferir("traz barbeiro, serviço e horários, e nunca o senhaHash",
      !!m2.barbeiro?.nome && !!m2.servico?.nome && !!m2.horaInicio && !!m2.horaFim && !JSON.stringify(m2).includes("senhaHash"));

    await api("PATCH", `/agendamentos/${ag1.id}/cancelar`, T.c1); // libera o horário: avisa o primeiro da fila
    const n2 = await pegar(T.c2, f2.json.id), n3 = await pegar(T.c3, f3.json.id);
    conferir("depois do cancelamento: o 1º vira NOTIFICADO, com prazo e podeConfirmar true",
      n2.status === "NOTIFICADO" && n2.podeConfirmar === true && new Date(n2.expiraEm).getTime() > Date.now() && n2.posicao === 1, `${n2.status} pos ${n2.posicao}`);
    conferir("o 2º continua AGUARDANDO na posição 2 (o avisado conta à frente) e não pode confirmar",
      n3.status === "AGUARDANDO" && n3.posicao === 2 && n3.pessoasNaFrente === 1 && n3.podeConfirmar === false);

    await db.filaDeEspera.update({ where: { id: f2.json.id }, data: { expiraEm: new Date(Date.now() - 60_000) } }); // o 1º estoura o prazo
    const aposPrazo3 = await pegar(T.c3, f3.json.id); // quem consulta resolve o vencimento do que está à frente
    conferir("prazo do 1º venceu: ao listar, o 2º já é avisado e passa para a posição 1",
      aposPrazo3.status === "NOTIFICADO" && aposPrazo3.posicao === 1 && aposPrazo3.podeConfirmar === true, `${aposPrazo3.status} pos ${aposPrazo3.posicao}`);
    const exp2 = await pegar(T.c2, f2.json.id);
    conferir("a entrada vencida aparece como EXPIRADO, sem posição e sem poder confirmar",
      exp2.status === "EXPIRADO" && exp2.posicao === null && exp2.pessoasNaFrente === null && exp2.podeConfirmar === false && exp2.expiraEm === null);
    conferir("o 3º sobe para a posição 2 (o expirado não conta mais)", (await pegar(T.c4, f4.json.id)).posicao === 2);

    const passada = await db.filaDeEspera.create({ data: { clienteId: c2.id, barbeiroId: barbeiro.id, servicoId: servico.id, status: "AGUARDANDO",
      horaInicio: new Date("2020-01-06T10:00:00Z"), horaFim: new Date("2020-01-06T10:45:00Z") } });
    conferir("AGUARDANDO de um horário que já passou aparece como EXPIRADO", (await pegar(T.c2, passada.id)).status === "EXPIRADO");

    console.log("\n== desistir ==");
    conferir("desistir de entrada de outro cliente => 403", (await api("DELETE", `/fila-de-espera/${f3.json.id}`, T.c4)).status === 403);
    conferir("entrada inexistente => 404", (await api("DELETE", "/fila-de-espera/00000000-0000-4000-8000-000000000000", T.c3)).status === 404);
    conferir("o avisado desiste => 204", (await api("DELETE", `/fila-de-espera/${f3.json.id}`, T.c3)).status === 204);
    const d3 = await pegar(T.c3, f3.json.id);
    conferir("a entrada fica como DESISTIU (histórico preservado)", d3.status === "DESISTIU" && d3.posicao === null && d3.podeConfirmar === false);
    const n4 = await pegar(T.c4, f4.json.id);
    conferir("ao desistir quem estava avisado, a vez passa para o próximo (que pode confirmar)", n4.status === "NOTIFICADO" && n4.podeConfirmar === true && n4.posicao === 1);
    conferir("desistir de novo => 400 (já não está ativa)", (await api("DELETE", `/fila-de-espera/${f3.json.id}`, T.c3)).status === 400);
    const conf = await api("POST", `/fila-de-espera/${f4.json.id}/confirmar`, T.c4);
    conferir("o fluxo de confirmar continua funcionando (201)", conf.status === 201 && conf.json.status === "CONFIRMADO", `${conf.status}`);

    console.log("\n== entradas simultâneas ==");
    await ocupar(c1.id, D5, "10:00", "10:45");
    const mesmo = await Promise.all(Array.from({ length: 6 }, () => entrar(T.c3, D5, "10:00")));
    const criadas = mesmo.filter((r) => r.status === 201).length;
    const repetidas = mesmo.filter((r) => r.status === 409).length;
    conferir("o MESMO cliente em 6 requisições simultâneas: só 1 entrada é criada (201) e as outras 5 recebem 409",
      criadas === 1 && repetidas === 5, `${criadas} x 201, ${repetidas} x 409, outros: ${mesmo.filter((r) => r.status !== 201 && r.status !== 409).map((r) => r.status).join(",") || "nenhum"}`);
    const ativasC3 = await db.filaDeEspera.count({ where: { clienteId: c3.id, horaInicio: combinarDataHora(D5, "10:00"), status: { in: ["AGUARDANDO", "NOTIFICADO"] } } });
    conferir("e no banco existe exatamente 1 entrada ativa desse cliente nesse horário", ativasC3 === 1, `${ativasC3}`);

    await ocupar(c1.id, D6, "10:00", "10:45");
    const varios = await Promise.all([T.c2, T.c3, T.c4].map((t) => entrar(t, D6, "10:00")));
    conferir("3 clientes DIFERENTES ao mesmo tempo: os 3 entram (201)", varios.every((r) => r.status === 201), varios.map((r) => r.status).join(","));
    const posicoes = (await Promise.all([[T.c2, varios[0]], [T.c3, varios[1]], [T.c4, varios[2]]].map(async ([t, r]: any) => (await pegar(t, r.json.id)).posicao))).sort();
    conferir("e ficam com posições distintas 1, 2 e 3 (ninguém empata)", posicoes.join(",") === "1,2,3", posicoes.join(","));
  } finally {
    servidor.close();
    await limparSobras();
  }
}

function ok(cond: boolean, valor: unknown) {
  if (!cond) throw new Error(`pré-condição do teste falhou (${String(valor)})`);
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
