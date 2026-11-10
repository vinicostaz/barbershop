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

  findNoPeriodo(barbeiroId: string, inicio: Date, fim: Date) {
    return db.bloqueioPeriodo.findMany({
      where: { barbeiroId, inicio: { lt: fim }, fim: { gt: inicio } },
      select: { inicio: true, fim: true },
      orderBy: { inicio: "asc" },
    });
  },

  // existe algum bloqueio que se sobrepõe ao intervalo [inicio, fim)?
  // duas faixas [A,B) e [C,D) se sobrepõem quando A < D e C < B
  findSobreposto(barbeiroId: string, inicio: Date, fim: Date) {
    return db.bloqueioPeriodo.findFirst({
      where: { barbeiroId, inicio: { lt: fim }, fim: { gt: inicio } },
    });
  },

  // bloqueios que se sobrepõem OU encostam em [inicio, fim) — candidatos a serem
  // juntados num só (ex.: 10h-12h e 12h-14h viram 10h-14h)
  findSobrepostosOuVizinhos(barbeiroId: string, inicio: Date, fim: Date) {
    return db.bloqueioPeriodo.findMany({
      where: { barbeiroId, inicio: { lte: fim }, fim: { gte: inicio } },
      orderBy: { inicio: "asc" },
    });
  },

  // troca os bloqueios antigos pelo bloqueio consolidado de uma vez só
  substituir(
    idsAntigos: string[],
    data: { barbeiroId: string; inicio: Date; fim: Date; motivo?: string }
  ) {
    return db.$transaction(async (tx) => {
      await tx.bloqueioPeriodo.deleteMany({ where: { id: { in: idsAntigos } } });
      return tx.bloqueioPeriodo.create({ data });
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
