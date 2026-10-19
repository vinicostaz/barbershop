import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler.js";
import { bloqueiosService } from "./bloqueios.service.js";

export const bloqueiosController = {
  async criar(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const { inicio, fim, motivo } = req.body;
    const bloqueio = await bloqueiosService.criar(req.user, req.params.barbeiroId, {
      inicio,
      fim,
      motivo,
    });
    return res.status(201).json(bloqueio);
  },

  async listarPorBarbeiro(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const bloqueios = await bloqueiosService.listarPorBarbeiro(req.user, req.params.barbeiroId);
    return res.json(bloqueios);
  },

  async remover(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    await bloqueiosService.remover(req.user, req.params.id);
    return res.status(204).send();
  },
};
