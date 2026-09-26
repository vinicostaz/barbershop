import { db } from "../../prisma/client.js";

export const servicosRepository = {
  findAll() {
    return db.servico.findMany({ orderBy: { nome: "asc" } });
  },

  findById(id: string) {
    return db.servico.findUnique({ where: { id } });
  },

  create(data: { nome: string; descricao?: string; duracaoMin: number; preco: number }) {
    return db.servico.create({ data });
  },

  update(
    id: string,
    data: Partial<{ nome: string; descricao: string; duracaoMin: number; preco: number }>
  ) {
    return db.servico.update({ where: { id }, data });
  },

  delete(id: string) {
    return db.servico.delete({ where: { id } });
  },
};
