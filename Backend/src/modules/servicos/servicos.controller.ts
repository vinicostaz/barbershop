import type { Request, Response } from "express";
import { servicosService } from "./servicos.service.js";

export const servicosController = {
  async listar(_req: Request, res: Response) {
    const servicos = await servicosService.listar();
    return res.json(servicos);
  },

  async buscarPorId(req: Request, res: Response) {
    const servico = await servicosService.buscarPorId(req.params.id);
    return res.json(servico);
  },

  async criar(req: Request, res: Response) {
    const { nome, descricao, duracaoMin, preco } = req.body;
    const servico = await servicosService.criar({ nome, descricao, duracaoMin, preco });
    return res.status(201).json(servico);
  },

  async atualizar(req: Request, res: Response) {
    const servico = await servicosService.atualizar(req.params.id, req.body);
    return res.json(servico);
  },

  async remover(req: Request, res: Response) {
    await servicosService.remover(req.params.id);
    return res.status(204).send();
  },
};
