import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler.js";
import { disponibilidadesService } from "./disponibilidades.service.js";

export const disponibilidadesController = {
  async listarDatasDisponiveis(req: Request<{ barbeiroId: string }>, res: Response) {
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

  async listarHorariosLivres(req: Request<{ barbeiroId: string }>, res: Response) {
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

  async listarPorBarbeiro(req: Request<{ barbeiroId: string }>, res: Response) {
    const disponibilidades = await disponibilidadesService.listarPorBarbeiro(
      req.params.barbeiroId
    );
    return res.json(disponibilidades);
  },

  async criar(req: Request<{ barbeiroId: string }>, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const { diaSemana, diasSemana, horaInicio, horaFim } = req.body;

    // vários dias de uma vez: { diasSemana: [1,2,3], horaInicio, horaFim } => lista criada
    if (diasSemana !== undefined) {
      if (diaSemana !== undefined) {
        throw new AppError("Envie diaSemana (um dia) ou diasSemana (vários dias), não os dois.");
      }
      const criadas = await disponibilidadesService.criarVariosDias(
        req.user,
        req.params.barbeiroId,
        { diasSemana, horaInicio, horaFim }
      );
      return res.status(201).json(criadas);
    }

    // um dia só (formato original): { diaSemana: 1, horaInicio, horaFim } => objeto criado
    const disponibilidade = await disponibilidadesService.criar(
      req.user,
      req.params.barbeiroId,
      { diaSemana, horaInicio, horaFim }
    );
    return res.status(201).json(disponibilidade);
  },

  async atualizar(req: Request<{ id: string }>, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const disponibilidade = await disponibilidadesService.atualizar(
      req.user,
      req.params.id,
      req.body
    );
    return res.json(disponibilidade);
  },

  async remover(req: Request<{ id: string }>, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    await disponibilidadesService.remover(req.user, req.params.id);
    return res.status(204).send();
  },
};
