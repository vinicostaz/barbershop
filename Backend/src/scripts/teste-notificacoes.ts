// Testes das notificações:
//   - GET   /notificacoes/nao-lidas/contagem
//   - PATCH /notificacoes/lidas (marcar todas)
//   - aviso ao cliente quando o barbeiro/admin cancela o agendamento
//   - aviso ao cliente quando o atendimento é concluído (convite para avaliar)
//
//   npm run test:notificacoes
//
// Roda contra o seu Postgres de verdade. Cria os próprios dados (e-mails notif-...@teste.local)
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
    where: { email: { startsWith: "notif-", endsWith: "@teste.local" } },
    select: { id: true },
  });
  const ids = sobras.map((u) => u.id);
  if (ids.length > 0) {
    await db.notificacao.deleteMany({ where: { usuarioId: { in: ids } } });
    await db.filaDeEspera.deleteMany({ where: { OR: [{ barbeiroId: { in: ids } }, { clienteId: { in: ids } }] } });
    await db.agendamento.deleteMany({ where: { OR: [{ barbeiroId: { in: ids } }, { clienteId: { in: ids } }] } });
    await db.usuario.deleteMany({ where: { id: { in: ids } } });
  }
  await db.servico.deleteMany({ where: { nome: { startsWith: "Teste Notif" } } });
}

const diaMais = (n: number) => {
  const d = agoraComoHoraDeParede();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function main() {
  await limparSobras();

  const criarUsuario = (sufixo: string, nome: string, role: "CLIENTE" | "BARBEIRO" | "ADMINISTRADOR") =>
    db.usuario.create({ data: { nome, email: `notif-${RUN}-${sufixo}@teste.local`, senhaHash: "x", role } });
  const barbeiro = await criarUsuario("barbeiro", "João", "BARBEIRO");
  const cliente = await criarUsuario("cliente", "Cliente Notif", "CLIENTE");
  const outroCliente = await criarUsuario("outro", "Outro Cliente", "CLIENTE");
  const admin = await criarUsuario("admin", "Admin Notif", "ADMINISTRADOR");
  const servico = await db.servico.create({ data: { nome: `Teste Notif ${RUN}`, duracaoMin: 30, preco: 1 } });

  const tk = (id: string, role: string) => jwt.sign({ sub: id, role }, env.jwtSecret, { expiresIn: "10m" });
  const T = {
    barbeiro: tk(barbeiro.id, "BARBEIRO"),
    cliente: tk(cliente.id, "CLIENTE"),
    outro: tk(outroCliente.id, "CLIENTE"),
    admin: tk(admin.id, "ADMINISTRADOR"),
  };

  const servidor = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => servidor.once("listening", () => r()));
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  async function api(metodo: string, caminho: string, token: string) {
    const r = await fetch(base + caminho, { method: metodo, headers: { Authorization: `Bearer ${token}` } });
    let json: any = null;
    try { json = await r.json(); } catch { /* sem corpo */ }
    return { status: r.status, json };
  }
  const agendar = (data: string, ini: string, fim: string) =>
    db.agendamento.create({
      data: {
        clienteId: cliente.id, barbeiroId: barbeiro.id, servicoId: servico.id,
        data: combinarDataHora(data, "00:00"), horaInicio: combinarDataHora(data, ini), horaFim: combinarDataHora(data, fim),
      },
    });
  const contagem = async (token: string) => (await api("GET", "/notificacoes/nao-lidas/contagem", token)).json?.naoLidas;
  const notificacoesDoCliente = async () => (await api("GET", "/notificacoes", T.cliente)).json as any[];

  try {
    const amanha = diaMais(1);
    const ontem = diaMais(-1);
    const [dd, mm] = [amanha.slice(8, 10), amanha.slice(5, 7)];

    console.log("\n== contagem inicial ==");
    conferir("cliente sem notificações => naoLidas 0", (await contagem(T.cliente)) === 0);

    console.log("\n== cancelamento ==");
    const peloCliente = await agendar(amanha, "09:00", "09:30");
    let r = await api("PATCH", `/agendamentos/${peloCliente.id}/cancelar`, T.cliente);
    conferir("cliente cancela o próprio agendamento => 200", r.status === 200 && r.json?.status === "CANCELADO", String(r.status));
    conferir("e NÃO recebe aviso (foi ele que cancelou)", (await contagem(T.cliente)) === 0);

    const peloBarbeiro = await agendar(amanha, "10:00", "10:30");
    r = await api("PATCH", `/agendamentos/${peloBarbeiro.id}/cancelar`, T.barbeiro);
    conferir("barbeiro cancela => 200", r.status === 200 && r.json?.status === "CANCELADO");
    let lista = await notificacoesDoCliente();
    const aviso = lista.find((n) => n.tipo === "AGENDAMENTO_CANCELADO");
    conferir("cliente recebe aviso AGENDAMENTO_CANCELADO ligado ao agendamento",
      aviso?.agendamentoId === peloBarbeiro.id && aviso?.lida === false, JSON.stringify(aviso));
    conferir("mensagem traz serviço, barbeiro, data e hora",
      aviso?.mensagem === `Seu agendamento de Teste Notif ${RUN} com João em ${dd}/${mm} às 10:00 foi cancelado pela barbearia.`,
      aviso?.mensagem);

    const peloAdmin = await agendar(amanha, "11:00", "11:30");
    await api("PATCH", `/agendamentos/${peloAdmin.id}/cancelar`, T.admin);
    conferir("administrador cancela => cliente também é avisado (2 não lidas)", (await contagem(T.cliente)) === 2);

    const duplo = await agendar(amanha, "12:00", "12:30");
    const simultaneos = await Promise.all([1, 2, 3].map(() => api("PATCH", `/agendamentos/${duplo.id}/cancelar`, T.barbeiro)));
    conferir("3 cancelamentos simultâneos: só 1 dá certo", simultaneos.filter((x) => x.status === 200).length === 1,
      simultaneos.map((x) => x.status).join(","));
    conferir("e o cliente recebe só 1 aviso (3 não lidas)", (await contagem(T.cliente)) === 3);

    console.log("\n== conclusão ==");
    const atendido = await agendar(ontem, "15:00", "15:30");
    r = await api("PATCH", `/agendamentos/${atendido.id}/concluir`, T.barbeiro);
    conferir("barbeiro conclui => 200", r.status === 200 && r.json?.status === "CONCLUIDO");
    lista = await notificacoesDoCliente();
    const convite = lista.find((n) => n.tipo === "ATENDIMENTO_CONCLUIDO");
    conferir("cliente recebe ATENDIMENTO_CONCLUIDO ligado ao agendamento", convite?.agendamentoId === atendido.id, JSON.stringify(convite));
    conferir("mensagem fala do ponto e convida para avaliar",
      typeof convite?.mensagem === "string" && convite.mensagem.includes("1 ponto de fidelidade") && convite.mensagem.includes("avalie"),
      convite?.mensagem);
    conferir("4 não lidas", (await contagem(T.cliente)) === 4);

    console.log("\n== marcar como lidas ==");
    r = await api("PATCH", `/notificacoes/${convite.id}/lida`, T.cliente);
    conferir("marcar uma como lida continua funcionando => 3 não lidas", r.status === 200 && (await contagem(T.cliente)) === 3);
    r = await api("PATCH", "/notificacoes/lidas", T.outro);
    conferir("outro cliente marca todas: não mexe nas do cliente", r.json?.atualizadas === 0 && (await contagem(T.cliente)) === 3);
    r = await api("PATCH", "/notificacoes/lidas", T.cliente);
    conferir("marcar todas => atualizadas 3 e naoLidas 0", r.status === 200 && r.json?.atualizadas === 3 && (await contagem(T.cliente)) === 0,
      JSON.stringify(r.json));
    r = await api("PATCH", "/notificacoes/lidas", T.cliente);
    conferir("marcar todas de novo => atualizadas 0", r.json?.atualizadas === 0);

    console.log("\n== autenticação ==");
    conferir("contagem sem login => 401", (await fetch(`${base}/notificacoes/nao-lidas/contagem`)).status === 401);
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
