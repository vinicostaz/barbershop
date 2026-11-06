import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler.js";
import { notificacoesService } from "./notificacoes.service.js";

export const notificacoesController = {
  async listar(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const notificacoes = await notificacoesService.listar(req.user);
    return res.json(notificacoes);
  },

  async contarNaoLidas(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const resultado = await notificacoesService.contarNaoLidas(req.user);
    res.set("Cache-Control", "no-store");
    return res.json(resultado);
  },

  async marcarTodasComoLidas(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const resultado = await notificacoesService.marcarTodasComoLidas(req.user);
    return res.json(resultado);
  },

  async marcarComoLida(req: Request<{ id: string }>, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const notificacao = await notificacoesService.marcarComoLida(req.user, req.params.id);
    return res.json(notificacao);
  },
};
