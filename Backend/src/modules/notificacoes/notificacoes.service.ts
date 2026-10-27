import type { AuthPayload } from "../../middlewares/authMiddleware.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { notificacoesRepository } from "./notificacoes.repository.js";

export const notificacoesService = {
  listar(usuarioLogado: AuthPayload) {
    return notificacoesRepository.findByUsuario(usuarioLogado.sub);
  },

  async marcarComoLida(usuarioLogado: AuthPayload, id: string) {
    const notificacao = await notificacoesRepository.findById(id);
    if (!notificacao) {
      throw new AppError("Notificação não encontrada.", 404);
    }
    if (notificacao.usuarioId !== usuarioLogado.sub) {
      throw new AppError("Você não tem permissão para alterar esta notificação.", 403);
    }
    return notificacoesRepository.marcarComoLida(id);
  },
};
