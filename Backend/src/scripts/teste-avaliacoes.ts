// Testes das avaliações:
//   - POST /avaliacoes (cliente avalia atendimento concluído, uma vez)
//   - GET  /avaliacoes/barbeiros/:barbeiroId (público: média, total e lista)
//   - GET  /avaliacoes/minhas
//   - GET  /agendamentos do cliente traz a avaliação de cada atendimento
//
//   npm run test:avaliacoes
//
// Roda contra o seu Postgres de verdade. Cria os próprios dados (e-mails aval-...@teste.local)
// e apaga tudo no final, mesmo que um teste falhe. Não precisa deixar o servidor ligado.
import "dotenv/config";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "../app.js";
import { env } from "../config/env.js";
import { agoraComoHoraDeParede } from "../modules/agendamentos/agendamentos.tempo.js";
import { combinarDataHora } from "../modules/agendamentos/agendamentos.utils.js";
import { db } from "../prisma/client.js";

if (process.env.NODE_ENV === "production") {
  console.error("Recusado: este teste cria e apaga dados e não deve rodar em produção.");
  process.exit(1);
}

const RUN = Date.now().toString(36);

const resultados: { nome: string; ok: boolean }[] = [];
function conferir(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${nome}${detalhe ? `  (${detalhe})` : ""}`);
  resultados.push({ nome, ok });
}

async function limparSobras() {
  const sobras = await db.usuario.findMany({
    where: { email: { startsWith: "aval-", endsWith: "@teste.local" } },
    select: { id: true },
  });
  const ids = sobras.map((u) => u.id);
  if (ids.length > 0) {
    await db.avaliacao.deleteMany({ where: { clienteId: { in: ids } } });
    await db.notificacao.deleteMany({ where: { usuarioId: { in: ids } } });
    await db.agendamento.deleteMany({ where: { OR: [{ barbeiroId: { in: ids } }, { clienteId: { in: ids } }] } });
    await db.usuario.deleteMany({ where: { id: { in: ids } } });
  }
  await db.servico.deleteMany({ where: { nome: { startsWith: "Teste Aval" } } });
}

const diaMais = (n: number) => {
  const d = agoraComoHoraDeParede();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function main() {
  await limparSobras();

  const criarUsuario = (sufixo: string, nome: string, role: "CLIENTE" | "BARBEIRO") =>
    db.usuario.create({ data: { nome, email: `aval-${RUN}-${sufixo}@teste.local`, senhaHash: "x", role } });
  const barbeiro = await criarUsuario("barbeiro", "Barbeiro Aval", "BARBEIRO");
  const semAvaliacoes = await criarUsuario("novato", "Barbeiro Novato", "BARBEIRO");
  const cliente = await criarUsuario("cliente", "Ana", "CLIENTE");
  const outroCliente = await criarUsuario("outro", "Bruno", "CLIENTE");
  const servico = await db.servico.create({ data: { nome: `Teste Aval ${RUN}`, duracaoMin: 30, preco: 1 } });

  const tk = (id: string, role: string) => jwt.sign({ sub: id, role }, env.jwtSecret, { expiresIn: "10m" });
  const T = { cliente: tk(cliente.id, "CLIENTE"), outro: tk(outroCliente.id, "CLIENTE"), barbeiro: tk(barbeiro.id, "BARBEIRO") };

  const servidor = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => servidor.once("listening", () => r()));
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  async function api(metodo: string, caminho: string, token?: string, corpo?: unknown) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(base + caminho, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    const texto = await r.text();
    let json: any = null;
    try { json = JSON.parse(texto); } catch { /* sem corpo */ }
    return { status: r.status, json, texto };
  }
  const agendar = (clienteId: string, hora: string, status: "CONFIRMADO" | "CONCLUIDO" | "CANCELADO") => {
    const dia = diaMais(-2);
    const [h, m] = hora.split(":").map(Number);
    const fim = `${String(h).padStart(2, "0")}:${String(m + 30).padStart(2, "0")}`;
    return db.agendamento.create({
      data: {
        clienteId, barbeiroId: barbeiro.id, servicoId: servico.id, status,
        data: combinarDataHora(dia, "00:00"), horaInicio: combinarDataHora(dia, hora), horaFim: combinarDataHora(dia, fim),
      },
    });
  };
  const avaliar = (token: string, corpo: unknown) => api("POST", "/avaliacoes", token, corpo);

  try {
    const concluido = await agendar(cliente.id, "09:00", "CONCLUIDO");
    const concluido2 = await agendar(cliente.id, "10:00", "CONCLUIDO");
    const doOutro = await agendar(outroCliente.id, "11:00", "CONCLUIDO");
    const confirmado = await agendar(cliente.id, "12:00", "CONFIRMADO");
    const cancelado = await agendar(cliente.id, "13:00", "CANCELADO");

    console.log("\n== média sem avaliações ==");
    let r = await api("GET", `/avaliacoes/barbeiros/${semAvaliacoes.id}`);
    conferir("barbeiro sem avaliações => media null, total 0, lista vazia",
      r.status === 200 && r.json.media === null && r.json.total === 0 && r.json.avaliacoes.length === 0, JSON.stringify(r.json));

    console.log("\n== regras ==");
    conferir("sem login => 401", (await api("POST", "/avaliacoes", undefined, { agendamentoId: concluido.id, nota: 5 })).status === 401);
    conferir("barbeiro não avalia => 403", (await avaliar(T.barbeiro, { agendamentoId: concluido.id, nota: 5 })).status === 403);
    conferir("cliente não avalia atendimento de outro => 403", (await avaliar(T.cliente, { agendamentoId: doOutro.id, nota: 5 })).status === 403);
    conferir("agendamento ainda confirmado => 400", (await avaliar(T.cliente, { agendamentoId: confirmado.id, nota: 5 })).status === 400);
    conferir("agendamento cancelado => 400", (await avaliar(T.cliente, { agendamentoId: cancelado.id, nota: 5 })).status === 400);
    conferir("nota 6 => 400", (await avaliar(T.cliente, { agendamentoId: concluido.id, nota: 6 })).status === 400);
    conferir("agendamento inexistente => 404",
      (await avaliar(T.cliente, { agendamentoId: "00000000-0000-0000-0000-000000000000", nota: 5 })).status === 404);

    console.log("\n== avaliar ==");
    r = await avaliar(T.cliente, { agendamentoId: concluido.id, nota: 5, comentario: "  Ótimo corte!  " });
    conferir("cliente avalia atendimento concluído => 201", r.status === 201 && r.json.nota === 5 && r.json.comentario === "Ótimo corte!",
      JSON.stringify(r.json));
    conferir("avaliar de novo o mesmo atendimento => 409", (await avaliar(T.cliente, { agendamentoId: concluido.id, nota: 1 })).status === 409);

    const simultaneas = await Promise.all([1, 2, 3].map(() => avaliar(T.cliente, { agendamentoId: concluido2.id, nota: 4 })));
    conferir("3 avaliações simultâneas do mesmo atendimento: só 1 entra (as outras 409)",
      simultaneas.filter((x) => x.status === 201).length === 1 && simultaneas.filter((x) => x.status === 409).length === 2,
      simultaneas.map((x) => x.status).join(","));

    await avaliar(T.outro, { agendamentoId: doOutro.id, nota: 4 });

    console.log("\n== consulta pública ==");
    r = await api("GET", `/avaliacoes/barbeiros/${barbeiro.id}`);
    conferir("média (5+4+4)/3 = 4.3 e total 3", r.status === 200 && r.json.media === 4.3 && r.json.total === 3, JSON.stringify({ media: r.json.media, total: r.json.total }));
    const primeira = r.json.avaliacoes.find((a: any) => a.comentario === "Ótimo corte!");
    conferir("cada avaliação traz nota, comentário, nome do cliente e serviço",
      primeira?.cliente === "Ana" && primeira?.servico === `Teste Aval ${RUN}` && primeira?.nota === 5, JSON.stringify(primeira));
    conferir("não expõe e-mail nem id do cliente", !r.texto.includes("@teste.local") && !r.texto.includes(cliente.id));
    conferir("barbeiro inexistente => 404", (await api("GET", `/avaliacoes/barbeiros/${cliente.id}`)).status === 404);

    console.log("\n== do lado do cliente ==");
    r = await api("GET", "/avaliacoes/minhas", T.cliente);
    conferir("minhas avaliações => 2, com barbeiro e serviço", r.status === 200 && r.json.length === 2 && r.json[0].agendamento?.barbeiro?.nome === "Barbeiro Aval");
    conferir("barbeiro em /minhas => 403", (await api("GET", "/avaliacoes/minhas", T.barbeiro)).status === 403);
    r = await api("GET", "/agendamentos", T.cliente);
    const doHistorico = (id: string) => r.json.find((a: any) => a.id === id);
    conferir("histórico do cliente traz a avaliação feita", doHistorico(concluido.id)?.avaliacao?.nota === 5);
    conferir("e avaliacao null nos ainda não avaliados", doHistorico(confirmado.id)?.avaliacao === null);
  } finally {
    servidor.close();
    await limparSobras();
  }

  const falhas = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - falhas.length}/${resultados.length} passaram`);
  await db.$disconnect();
  process.exit(falhas.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await limparSobras().catch(() => {});
  await db.$disconnect();
  process.exit(1);
});
