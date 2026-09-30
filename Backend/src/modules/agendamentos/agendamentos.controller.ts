import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler.js";
import { agendamentosService } from "./agendamentos.service.js";

export const agendamentosController = {
  async criar(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const { barbeiroId, servicoId, data, horaInicio } = req.body;
    const agendamento = await agendamentosService.criar(req.user, {
      barbeiroId,
      servicoId,
      data,
      horaInicio,
    });
    return res.status(201).json(agendamento);
  },

  async cancelar(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const agendamento = await agendamentosService.cancelar(req.user, req.params.id);
    return res.json(agendamento);
  },

  async listar(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const agendamentos = await agendamentosService.listarParaUsuarioLogado(req.user);
    return res.json(agendamentos);
  },
};
