import { db } from "../../prisma/client.js";

export const bloqueiosRepository = {
  create(data: { barbeiroId: string; inicio: Date; fim: Date; motivo?: string }) {
    return db.bloqueioPeriodo.create({ data });
  },

  findById(id: string) {
    return db.bloqueioPeriodo.findUnique({ where: { id } });
  },

  findByBarbeiro(barbeiroId: string) {
    return db.bloqueioPeriodo.findMany({ where: { barbeiroId }, orderBy: { inicio: "asc" } });
  },

  // existe algum bloqueio que se sobrepõe ao intervalo [inicio, fim)?
  // duas faixas [A,B) e [C,D) se sobrepõem quando A < D e C < B
  findSobreposto(barbeiroId: string, inicio: Date, fim: Date) {
    return db.bloqueioPeriodo.findFirst({
      where: { barbeiroId, inicio: { lt: fim }, fim: { gt: inicio } },
    });
  },

  // quantos agendamentos confirmados cairiam dentro do período a bloquear
  contarAgendamentosConfirmados(barbeiroId: string, inicio: Date, fim: Date) {
    return db.agendamento.count({
      where: {
        barbeiroId,
        status: "CONFIRMADO",
        horaInicio: { lt: fim },
        horaFim: { gt: inicio },
      },
    });
  },

  delete(id: string) {
    return db.bloqueioPeriodo.delete({ where: { id } });
  },
};
