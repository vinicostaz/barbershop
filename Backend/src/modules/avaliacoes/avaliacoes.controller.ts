import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler.js";
import { avaliacoesService } from "./avaliacoes.service.js";

export const avaliacoesController = {
  async avaliar(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const { agendamentoId, nota, comentario } = req.body ?? {};
    const avaliacao = await avaliacoesService.avaliar(req.user, { agendamentoId, nota, comentario });
    return res.status(201).json(avaliacao);
  },

  async listarPorBarbeiro(req: Request<{ barbeiroId: string }>, res: Response) {
    const resultado = await avaliacoesService.listarPorBarbeiro(req.params.barbeiroId);
    return res.json(resultado);
  },

  async listarMinhas(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const avaliacoes = await avaliacoesService.listarMinhas(req.user);
    return res.json(avaliacoes);
  },
};
