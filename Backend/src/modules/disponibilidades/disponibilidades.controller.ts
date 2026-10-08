import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler.js";
import { disponibilidadesService } from "./disponibilidades.service.js";

export const disponibilidadesController = {
  async listarDatasDisponiveis(req: Request, res: Response) {
    const servicoId =
      typeof req.query.servicoId === "string" ? req.query.servicoId : "";
    const limite =
      typeof req.query.limite === "string" ? Number(req.query.limite) : 5;
    const datas = await disponibilidadesService.listarDatasDisponiveis(
      req.params.barbeiroId,
      servicoId,
      limite
    );
    res.set("Cache-Control", "no-store");
    return res.json(datas);
  },

  async listarHorariosLivres(req: Request, res: Response) {
    const data = typeof req.query.data === "string" ? req.query.data : "";
    const servicoId =
      typeof req.query.servicoId === "string" ? req.query.servicoId : "";
    const horarios = await disponibilidadesService.listarHorariosLivres(
      req.params.barbeiroId,
      data,
      servicoId
    );
    res.set("Cache-Control", "no-store");
    return res.json(horarios);
  },

  async listarPorBarbeiro(req: Request, res: Response) {
    const disponibilidades = await disponibilidadesService.listarPorBarbeiro(
      req.params.barbeiroId
    );
    return res.json(disponibilidades);
  },

  async criar(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const { diaSemana, horaInicio, horaFim } = req.body;
    const disponibilidade = await disponibilidadesService.criar(
      req.user,
      req.params.barbeiroId,
      { diaSemana, horaInicio, horaFim }
    );
    return res.status(201).json(disponibilidade);
  },

  async atualizar(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const disponibilidade = await disponibilidadesService.atualizar(
      req.user,
      req.params.id,
      req.body
    );
    return res.json(disponibilidade);
  },

  async remover(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    await disponibilidadesService.remover(req.user, req.params.id);
    return res.status(204).send();
  },
};
