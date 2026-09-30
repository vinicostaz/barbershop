import { db } from "../../prisma/client.js";

export const agendamentosRepository = {
  findConflitante(barbeiroId: string, horaInicio: Date, horaFim: Date) {
    return db.agendamento.findFirst({
      where: {
        barbeiroId,
        status: "CONFIRMADO",
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
    return db.agendamento.create({
      data,
      include: { cliente: true, barbeiro: true, servico: true },
    });
  },

  findById(id: string) {
    return db.agendamento.findUnique({
      where: { id },
      include: { cliente: true, barbeiro: true, servico: true },
    });
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
      include: { cliente: true, barbeiro: true, servico: true },
      orderBy: { horaInicio: "desc" },
    });
  },

  updateStatus(id: string, status: "CONFIRMADO" | "CANCELADO" | "CONCLUIDO") {
    return db.agendamento.update({ where: { id }, data: { status } });
  },
};
