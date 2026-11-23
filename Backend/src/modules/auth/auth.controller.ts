import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler.js";
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

  async obterPerfil(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const usuario = await authService.obterPerfil(req.user.sub);
    return res.json(usuario);
  },

  async atualizarPerfil(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const { nome, email, telefone } = req.body;
    const usuario = await authService.atualizarPerfil(req.user.sub, {
      nome,
      email,
      telefone,
    });
    return res.json(usuario);
  },

  async criarUsuarioAdministrativo(req: Request, res: Response) {
    const { nome, email, senha, telefone, role } = req.body;
    const usuario = await authService.criarUsuarioAdministrativo({
      nome,
      email,
      senha,
      telefone,
      role,
    });
    return res.status(201).json(usuario);
  },
};
