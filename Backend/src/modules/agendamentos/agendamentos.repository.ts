import { db } from "../../prisma/client.js";

const includeCompleto = { cliente: true, barbeiro: true, servico: true } as const;

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

  create(data: {
    clienteId: string;
    barbeiroId: string;
    servicoId: string;
    data: Date;
    horaInicio: Date;
    horaFim: Date;
  }) {
    return db.agendamento.create({ data, include: includeCompleto });
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
      await tx.agendamento.update({ where: { id }, data: { status: "CANCELADO" } });
      return tx.agendamento.create({ data: novo, include: includeCompleto });
    });
  },

  findById(id: string) {
    return db.agendamento.findUnique({ where: { id }, include: includeCompleto });
  },

  findByCliente(clienteId: string) {
    return db.agendamento.findMany({
      where: { clienteId },
      include: { barbeiro: true, servico: true },
      orderBy: { horaInicio: "desc" },
    });
  },

  findByBarbeiro(barbeiroId: string) {
    return db.agendamento.findMany({
      where: { barbeiroId },
      include: { cliente: true, servico: true },
      orderBy: { horaInicio: "asc" },
    });
  },

  findAll() {
    return db.agendamento.findMany({
      include: includeCompleto,
      orderBy: { horaInicio: "desc" },
    });
  },

  updateStatus(id: string, status: "CONFIRMADO" | "CANCELADO" | "CONCLUIDO") {
    return db.agendamento.update({ where: { id }, data: { status } });
  },
};
