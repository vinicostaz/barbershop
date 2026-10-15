import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler.js";
import { filaDeEsperaService } from "./filaDeEspera.service.js";

export const filaDeEsperaController = {
  async entrar(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const { barbeiroId, servicoId, data, horaInicio } = req.body;
    const entrada = await filaDeEsperaService.entrar(req.user, {
      barbeiroId,
      servicoId,
      data,
      horaInicio,
    });
    return res.status(201).json(entrada);
  },

  async confirmar(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const agendamento = await filaDeEsperaService.confirmar(req.user, req.params.id);
    return res.status(201).json(agendamento);
  },

  async listar(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const entradas = await filaDeEsperaService.listar(req.user);
    return res.json(entradas);
  },
};
