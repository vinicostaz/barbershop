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
