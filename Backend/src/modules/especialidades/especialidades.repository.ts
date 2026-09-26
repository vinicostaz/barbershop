import { db } from "../../prisma/client.js";

export const especialidadesRepository = {
  findAll() {
    return db.especialidade.findMany({ orderBy: { nome: "asc" } });
  },

  findById(id: string) {
    return db.especialidade.findUnique({ where: { id } });
  },

  findByNome(nome: string) {
    return db.especialidade.findUnique({ where: { nome } });
  },

  create(data: { nome: string }) {
    return db.especialidade.create({ data });
  },

  update(id: string, data: { nome: string }) {
    return db.especialidade.update({ where: { id }, data });
  },

  delete(id: string) {
    return db.especialidade.delete({ where: { id } });
  },
};
