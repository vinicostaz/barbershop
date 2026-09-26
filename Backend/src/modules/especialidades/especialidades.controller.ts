import type { Request, Response } from "express";
import { especialidadesService } from "./especialidades.service.js";

export const especialidadesController = {
  async listar(_req: Request, res: Response) {
    const especialidades = await especialidadesService.listar();
    return res.json(especialidades);
  },

  async buscarPorId(req: Request, res: Response) {
    const especialidade = await especialidadesService.buscarPorId(req.params.id);
    return res.json(especialidade);
  },

  async criar(req: Request, res: Response) {
    const especialidade = await especialidadesService.criar(req.body.nome);
    return res.status(201).json(especialidade);
  },

  async atualizar(req: Request, res: Response) {
    const especialidade = await especialidadesService.atualizar(req.params.id, req.body.nome);
    return res.json(especialidade);
  },

  async remover(req: Request, res: Response) {
    await especialidadesService.remover(req.params.id);
    return res.status(204).send();
  },
};
