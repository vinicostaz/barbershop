import type { AuthPayload } from "../../middlewares/authMiddleware.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { notificacoesRepository } from "./notificacoes.repository.js";

export const notificacoesService = {
  listar(usuarioLogado: AuthPayload) {
    return notificacoesRepository.findByUsuario(usuarioLogado.sub);
  },

  // para o "sininho" do front: quantas notificações ainda não foram lidas
  async contarNaoLidas(usuarioLogado: AuthPayload) {
    const naoLidas = await notificacoesRepository.contarNaoLidas(usuarioLogado.sub);
    return { naoLidas };
  },

  async marcarTodasComoLidas(usuarioLogado: AuthPayload) {
    const atualizadas = await notificacoesRepository.marcarTodasComoLidas(usuarioLogado.sub);
    return { atualizadas };
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
