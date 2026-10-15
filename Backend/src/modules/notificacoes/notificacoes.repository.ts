import { db } from "../../prisma/client.js";

export const notificacoesRepository = {
  findByUsuario(usuarioId: string) {
    return db.notificacao.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: "desc" },
    });
  },

  findById(id: string) {
    return db.notificacao.findUnique({ where: { id } });
  },

  marcarComoLida(id: string) {
    return db.notificacao.update({ where: { id }, data: { lida: true } });
  },
};
