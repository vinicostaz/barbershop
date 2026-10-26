import { db } from "../../prisma/client.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { usuarioResumo } from "../../prisma/usuarioSemSenha.js";

const includeCompleto = {
  cliente: usuarioResumo,
  barbeiro: usuarioResumo,
  servico: true,
} as const;

const mensagemConflitoCliente =
  "Você já possui outro agendamento que se sobrepõe a esse horário.";

function conflitoDoCliente(
  clienteId: string,
  horaInicio: Date,
  horaFim: Date,
  ignorarId?: string
) {
  return {
    clienteId,
    status: "CONFIRMADO" as const,
    ...(ignorarId ? { id: { not: ignorarId } } : {}),
    horaInicio: { lt: horaFim },
    horaFim: { gt: horaInicio },
  };
}

export const agendamentosRepository = {
  // ignorarId: usado no reagendamento, pra o agendamento que está sendo movido
  // não ser considerado conflito dele mesmo (ex.: mover de 10:00 para 10:30).
  findConflitante(barbeiroId: string, horaInicio: Date, horaFim: Date, ignorarId?: string) {
    return db.agendamento.findFirst({
      where: {
        barbeiroId,
        status: "CONFIRMADO",
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
        // duas faixas [A,B) e [C,D) se sobrepõem quando A < D e C < B
        horaInicio: { lt: horaFim },
        horaFim: { gt: horaInicio },
      },
    });
  },

  findConflitanteCliente(
    clienteId: string,
    horaInicio: Date,
    horaFim: Date,
    ignorarId?: string
  ) {
    return db.agendamento.findFirst({
      where: conflitoDoCliente(clienteId, horaInicio, horaFim, ignorarId),
    });
  },

  async create(data: {
    clienteId: string;
    barbeiroId: string;
    servicoId: string;
    data: Date;
    horaInicio: Date;
    horaFim: Date;
  }) {
    return db.$transaction(async (tx) => {
      // Serializa operações do mesmo cliente. Assim, duas requisições simultâneas
      // para barbeiros diferentes não conseguem criar horários sobrepostos.
      await tx.$queryRaw`
        SELECT 1 AS locked
        FROM pg_advisory_xact_lock(hashtext(${data.clienteId}))
      `;
      const conflito = await tx.agendamento.findFirst({
        where: conflitoDoCliente(data.clienteId, data.horaInicio, data.horaFim),
        select: { id: true },
      });
      if (conflito) throw new AppError(mensagemConflitoCliente, 409);

      return tx.agendamento.create({ data, include: includeCompleto });
    });
  },

  // Cancela o antigo e cria o novo na MESMA transação: se o novo falhar
  // (ex.: exclusion constraint), o cancelamento também é desfeito e o
  // cliente não perde o agendamento original.
  reagendar(
    id: string,
    novo: {
      clienteId: string;
      barbeiroId: string;
      servicoId: string;
      data: Date;
      horaInicio: Date;
      horaFim: Date;
    }
  ) {
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT 1 AS locked
        FROM pg_advisory_xact_lock(hashtext(${novo.clienteId}))
      `;
      const conflito = await tx.agendamento.findFirst({
        where: conflitoDoCliente(novo.clienteId, novo.horaInicio, novo.horaFim, id),
        select: { id: true },
      });
      if (conflito) throw new AppError(mensagemConflitoCliente, 409);

      await tx.agendamento.update({ where: { id }, data: { status: "REAGENDADO" } });
      return tx.agendamento.create({ data: novo, include: includeCompleto });
    });
  },

  findById(id: string) {
    return db.agendamento.findUnique({ where: { id }, include: includeCompleto });
  },

  findByCliente(clienteId: string) {
    return db.agendamento.findMany({
      where: { clienteId },
      include: { barbeiro: usuarioResumo, servico: true },
      orderBy: { horaInicio: "desc" },
    });
  },

  findByBarbeiro(barbeiroId: string) {
    return db.agendamento.findMany({
      where: { barbeiroId },
      include: { cliente: usuarioResumo, servico: true },
      orderBy: { horaInicio: "asc" },
    });
  },

  findAll() {
    return db.agendamento.findMany({
      include: includeCompleto,
      orderBy: { horaInicio: "desc" },
    });
  },

  findConfirmadosNoPeriodo(barbeiroId: string, inicio: Date, fim: Date) {
    return db.agendamento.findMany({
      where: {
        barbeiroId,
        status: "CONFIRMADO",
        horaInicio: { lt: fim },
        horaFim: { gt: inicio },
      },
      select: { horaInicio: true, horaFim: true },
      orderBy: { horaInicio: "asc" },
    });
  },

  updateStatus(id: string, status: "CONFIRMADO" | "CANCELADO" | "CONCLUIDO" | "REAGENDADO") {
    return db.agendamento.update({ where: { id }, data: { status } });
  },
};
