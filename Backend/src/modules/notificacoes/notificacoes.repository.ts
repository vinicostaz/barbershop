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

  contarNaoLidas(usuarioId: string) {
    return db.notificacao.count({ where: { usuarioId, lida: false } });
  },

  // retorna quantas foram marcadas
  async marcarTodasComoLidas(usuarioId: string) {
    const { count } = await db.notificacao.updateMany({
      where: { usuarioId, lida: false },
      data: { lida: true },
    });
    return count;
  },
};
