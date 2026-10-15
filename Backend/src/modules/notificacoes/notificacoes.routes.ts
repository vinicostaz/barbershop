import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { notificacoesController } from "./notificacoes.controller.js";

export const notificacoesRoutes = Router();

notificacoesRoutes.use(authMiddleware); // cada usuário só vê as próprias notificações

notificacoesRoutes.get("/", asyncHandler(notificacoesController.listar));
notificacoesRoutes.patch("/:id/lida", asyncHandler(notificacoesController.marcarComoLida));
