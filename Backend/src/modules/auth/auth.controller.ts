import type { Request, Response } from "express";
import { authService } from "./auth.service.js";

export const authController = {
  async registrar(req: Request, res: Response) {
    const { nome, email, senha, telefone, role } = req.body;
    const resultado = await authService.registrar({ nome, email, senha, telefone, role });
    return res.status(201).json(resultado);
  },

  async login(req: Request, res: Response) {
    const { email, senha } = req.body;
    const resultado = await authService.login({ email, senha });
    return res.status(200).json(resultado);
  },
};
