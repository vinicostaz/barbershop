import { db } from "../../prisma/client.js";
import { usuarioResumo } from "../../prisma/usuarioSemSenha.js";

const includeCompleto = {
  cliente: usuarioResumo,
  barbeiro: usuarioResumo,
  servico: true,
} as const;

// duas faixas [A,B) e [C,D) se sobrepõem quando A < D e C < B
function sobrepoe(horaInicio: Date, horaFim: Date) {
  return { horaInicio: { lt: horaFim }, horaFim: { gt: horaInicio } };
}

export const filaDeEsperaRepository = {
  create(data: {
    clienteId: string;
    barbeiroId: string;
    servicoId: string;
    horaInicio: Date;
    horaFim: Date;
  }) {
    return db.filaDeEspera.create({ data, include: includeCompleto });
  },

  findById(id: string) {
    return db.filaDeEspera.findUnique({ where: { id }, include: includeCompleto });
  },

  // o cliente já está esperando (ou já foi avisado) por este mesmo horário?
  findDuplicada(clienteId: string, barbeiroId: string, horaInicio: Date) {
    return db.filaDeEspera.findFirst({
      where: { clienteId, barbeiroId, horaInicio, status: { in: ["AGUARDANDO", "NOTIFICADO"] } },
    });
  },

  findByCliente(clienteId: string) {
    return db.filaDeEspera.findMany({
      where: { clienteId },
      include: { barbeiro: usuarioResumo, servico: true },
      orderBy: { criadoEm: "desc" },
    });
  },

  findByBarbeiro(barbeiroId: string) {
    return db.filaDeEspera.findMany({
      where: { barbeiroId },
      include: { cliente: usuarioResumo, servico: true },
      orderBy: { criadoEm: "asc" },
    });
  },

  findAll() {
    return db.filaDeEspera.findMany({ include: includeCompleto, orderBy: { criadoEm: "desc" } });
  },

  findPrioridadesAtivasNoPeriodo(barbeiroId: string, inicio: Date, fim: Date) {
    return db.filaDeEspera.findMany({
      where: {
        barbeiroId,
        status: "NOTIFICADO",
        expiraEm: { gt: new Date() },
        horaInicio: { lt: fim },
        horaFim: { gt: inicio },
      },
      select: { horaInicio: true, horaFim: true },
    });
  },

  // NOTIFICADO cujo prazo já passou, em horário que se sobrepõe ao informado
  findVencidos(barbeiroId: string, horaInicio: Date, horaFim: Date) {
    return db.filaDeEspera.findMany({
      where: {
        barbeiroId,
        status: "NOTIFICADO",
        expiraEm: { lt: new Date() },
        ...sobrepoe(horaInicio, horaFim),
      },
    });
  },

  // NOTIFICADO com prazo ainda válido = alguém tem prioridade sobre esse horário
  findPrioridadeAtiva(
    barbeiroId: string,
    horaInicio: Date,
    horaFim: Date,
    ignorarClienteId?: string
  ) {
    return db.filaDeEspera.findFirst({
      where: {
        barbeiroId,
        status: "NOTIFICADO",
        expiraEm: { gt: new Date() },
        ...(ignorarClienteId ? { clienteId: { not: ignorarClienteId } } : {}),
        ...sobrepoe(horaInicio, horaFim),
      },
    });
  },

  // fila em ordem de chegada (quem entrou primeiro é avisado primeiro)
  findAguardando(barbeiroId: string, horaInicio: Date, horaFim: Date) {
    return db.filaDeEspera.findMany({
      where: { barbeiroId, status: "AGUARDANDO", ...sobrepoe(horaInicio, horaFim) },
      include: { barbeiro: usuarioResumo },
      orderBy: { criadoEm: "asc" },
    });
  },

  async marcarExpirado(id: string, clienteId: string) {
    await db.$transaction([
      db.filaDeEspera.update({ where: { id }, data: { status: "EXPIRADO" } }),
      db.notificacao.create({
        data: {
          usuarioId: clienteId,
          tipo: "PRIORIDADE_EXPIRADA",
          mensagem: "O prazo para confirmar o horário da fila de espera expirou.",
          filaDeEsperaId: id,
        },
      }),
    ]);
  },

  async marcarNotificado(id: string, clienteId: string, expiraEm: Date, mensagem: string) {
    const [entrada] = await db.$transaction([
      db.filaDeEspera.update({ where: { id }, data: { status: "NOTIFICADO", expiraEm } }),
      db.notificacao.create({
        data: { usuarioId: clienteId, tipo: "HORARIO_LIBERADO", mensagem, filaDeEsperaId: id },
      }),
    ]);
    return entrada;
  },

  // cria o agendamento e fecha a entrada da fila na MESMA transação
  async confirmar(
    id: string,
    agendamento: {
      clienteId: string;
      barbeiroId: string;
      servicoId: string;
      data: Date;
      horaInicio: Date;
      horaFim: Date;
    }
  ) {
    const [novo] = await db.$transaction([
      db.agendamento.create({ data: agendamento, include: includeCompleto }),
      db.filaDeEspera.update({ where: { id }, data: { status: "CONFIRMADO" } }),
    ]);
    return novo;
  },
};
