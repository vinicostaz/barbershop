import { Router } from "express";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { authMiddleware, requireRole } from "../../middlewares/authMiddleware.js";
import { authController } from "./auth.controller.js";

export const authRoutes = Router();

// UC01 - Cadastrar usuário
authRoutes.post("/registrar", asyncHandler(authController.registrar));

// UC02 - Autenticar usuário
authRoutes.post("/login", asyncHandler(authController.login));

// Cadastro interno: apenas administradores podem criar contas privilegiadas.
authRoutes.post(
  "/usuarios",
  authMiddleware,
  requireRole("ADMINISTRADOR"),
  asyncHandler(authController.criarUsuarioAdministrativo)
);
