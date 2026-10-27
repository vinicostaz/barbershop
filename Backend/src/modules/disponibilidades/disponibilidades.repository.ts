import { db } from "../../prisma/client.js";

export const disponibilidadesRepository = {
  findByBarbeiro(barbeiroId: string) {
    return db.disponibilidade.findMany({
      where: { barbeiroId },
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    });
  },

  findById(id: string) {
    return db.disponibilidade.findUnique({ where: { id } });
  },

  findSobreposta(
    barbeiroId: string,
    diaSemana: number,
    horaInicio: string,
    horaFim: string,
    ignorarId?: string
  ) {
    return db.disponibilidade.findFirst({
      where: {
        barbeiroId,
        diaSemana,
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
        horaInicio: { lt: horaFim },
        horaFim: { gt: horaInicio },
      },
    });
  },

  create(data: { barbeiroId: string; diaSemana: number; horaInicio: string; horaFim: string }) {
    return db.disponibilidade.create({ data });
  },

  update(id: string, data: Partial<{ diaSemana: number; horaInicio: string; horaFim: string }>) {
    return db.disponibilidade.update({ where: { id }, data });
  },

  delete(id: string) {
    return db.disponibilidade.delete({ where: { id } });
  },
};
