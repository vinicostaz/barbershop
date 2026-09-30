import type { Request, Response } from "express";
import { barbeirosService } from "./barbeiros.service.js";

export const barbeirosController = {
  async listar(_req: Request, res: Response) {
    const barbeiros = await barbeirosService.listar();
    return res.json(barbeiros);
  },

  async buscarPorId(req: Request, res: Response) {
    const barbeiro = await barbeirosService.buscarPorId(req.params.id);
    return res.json(barbeiro);
  },

  async criar(req: Request, res: Response) {
    const { nome, email, senha, telefone } = req.body;
    const barbeiro = await barbeirosService.criar({ nome, email, senha, telefone });
    return res.status(201).json(barbeiro);
  },

  async atualizar(req: Request, res: Response) {
    const barbeiro = await barbeirosService.atualizar(req.params.id, req.body);
    return res.json(barbeiro);
  },

  async atualizarEspecialidades(req: Request, res: Response) {
    const barbeiro = await barbeirosService.atualizarEspecialidades(
      req.params.id,
      req.body.especialidadeIds
    );
    return res.json(barbeiro);
  },
};
