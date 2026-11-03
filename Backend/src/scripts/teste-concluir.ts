// Testes de PATCH /agendamentos/:id/concluir (concluir atendimento + ponto de fidelidade)
//
//   npm run test:concluir
//
// Roda contra o seu Postgres de verdade. Cria os próprios dados (e-mails concluir-...@teste.local)
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
    where: { email: { startsWith: "concluir-", endsWith: "@teste.local" } },
    select: { id: true },
  });
  const ids = sobras.map((u) => u.id);
  if (ids.length > 0) {
    await db.notificacao.deleteMany({ where: { usuarioId: { in: ids } } });
    await db.agendamento.deleteMany({ where: { OR: [{ barbeiroId: { in: ids } }, { clienteId: { in: ids } }] } });
    await db.usuario.deleteMany({ where: { id: { in: ids } } });
  }
  await db.servico.deleteMany({ where: { nome: { startsWith: "Teste Concluir" } } });
}

const diaMais = (n: number) => {
  const d = agoraComoHoraDeParede();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function main() {
  await limparSobras();

  const criarUsuario = (sufixo: string, role: "CLIENTE" | "BARBEIRO" | "ADMINISTRADOR") =>
    db.usuario.create({
      data: { nome: `Teste Concluir ${sufixo}`, email: `concluir-${RUN}-${sufixo}@teste.local`, senhaHash: "x", role },
    });
  const barbeiro = await criarUsuario("barbeiro", "BARBEIRO");
  const outroBarbeiro = await criarUsuario("outro", "BARBEIRO");
  const cliente = await criarUsuario("cliente", "CLIENTE");
  const admin = await criarUsuario("admin", "ADMINISTRADOR");
  const servico = await db.servico.create({ data: { nome: `Teste Concluir ${RUN}`, duracaoMin: 30, preco: 1 } });

  const tk = (id: string, role: string) => jwt.sign({ sub: id, role }, env.jwtSecret, { expiresIn: "10m" });
  const T = {
    barbeiro: tk(barbeiro.id, "BARBEIRO"),
    outro: tk(outroBarbeiro.id, "BARBEIRO"),
    cliente: tk(cliente.id, "CLIENTE"),
    admin: tk(admin.id, "ADMINISTRADOR"),
  };

  const servidor = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => servidor.once("listening", () => r()));
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  async function concluir(id: string, token: string) {
    const r = await fetch(`${base}/agendamentos/${id}/concluir`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    let json: any = null;
    try { json = await r.json(); } catch { /* sem corpo */ }
    return { status: r.status, json };
  }
  const agendar = (data: string, ini: string, fim: string, status: "CONFIRMADO" | "CANCELADO" = "CONFIRMADO") =>
    db.agendamento.create({
      data: {
        clienteId: cliente.id, barbeiroId: barbeiro.id, servicoId: servico.id, status,
        data: combinarDataHora(data, "00:00"), horaInicio: combinarDataHora(data, ini), horaFim: combinarDataHora(data, fim),
      },
    });
  const pontos = async () => (await db.usuario.findUniqueOrThrow({ where: { id: cliente.id } })).pontosFidelidade;

  try {
    const ontem = diaMais(-1);
    const amanha = diaMais(1);
    const a1 = await agendar(ontem, "10:00", "10:30");
    const a2 = await agendar(ontem, "11:00", "11:30");
    const a3 = await agendar(ontem, "12:00", "12:30");
    const cancelado = await agendar(ontem, "13:00", "13:30", "CANCELADO");
    const futuro = await agendar(amanha, "10:00", "10:30");

    console.log("\n== permissões ==");
    conferir("cliente não pode concluir => 403", (await concluir(a1.id, T.cliente)).status === 403);
    conferir("barbeiro de outro atendimento não pode concluir => 403", (await concluir(a1.id, T.outro)).status === 403);
    conferir("agendamento inexistente => 404", (await concluir("00000000-0000-0000-0000-000000000000", T.barbeiro)).status === 404);

    console.log("\n== regras ==");
    conferir("atendimento que ainda não começou => 400", (await concluir(futuro.id, T.barbeiro)).status === 400);
    conferir("agendamento cancelado => 400", (await concluir(cancelado.id, T.barbeiro)).status === 400);
    conferir("nenhum ponto foi dado até aqui", (await pontos()) === 0);

    console.log("\n== conclusão ==");
    const r1 = await concluir(a1.id, T.barbeiro);
    conferir("barbeiro do atendimento conclui => 200 e status CONCLUIDO", r1.status === 200 && r1.json?.status === "CONCLUIDO", `${r1.status} ${r1.json?.status}`);
    conferir("cliente ganhou 1 ponto", (await pontos()) === 1);
    conferir("concluir de novo => 400 e o ponto não se repete", (await concluir(a1.id, T.barbeiro)).status === 400 && (await pontos()) === 1);
    conferir("a resposta não expõe senha", !JSON.stringify(r1.json).includes("senhaHash"));

    const rAdmin = await concluir(a2.id, T.admin);
    conferir("administrador também conclui => 200, cliente com 2 pontos", rAdmin.status === 200 && (await pontos()) === 2);

    console.log("\n== concorrência ==");
    const simultaneas = await Promise.all([1, 2, 3, 4, 5].map(() => concluir(a3.id, T.barbeiro)));
    const sucessos = simultaneas.filter((r) => r.status === 200).length;
    conferir("5 conclusões simultâneas: só 1 dá certo", sucessos === 1, simultaneas.map((r) => r.status).join(","));
    conferir("e o cliente ganha só 1 ponto por ela (total 3)", (await pontos()) === 3, String(await pontos()));
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
