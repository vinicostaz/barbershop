import { Router } from "express";
import { authMiddleware, requireRole } from "../../middlewares/authMiddleware.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { disponibilidadesController } from "./disponibilidades.controller.js";

export const disponibilidadesRoutes = Router();

// UC05 - Consultar disponibilidade (público, cliente precisa ver antes de agendar)
disponibilidadesRoutes.get(
  "/barbeiros/:barbeiroId",
  asyncHandler(disponibilidadesController.listarPorBarbeiro)
);

// UC15 - Gerenciar disponibilidade (o próprio Barbeiro, ou Administrador)
disponibilidadesRoutes.post(
  "/barbeiros/:barbeiroId",
  authMiddleware,
  requireRole("BARBEIRO", "ADMINISTRADOR"),
  asyncHandler(disponibilidadesController.criar)
);
disponibilidadesRoutes.put(
  "/:id",
  authMiddleware,
  requireRole("BARBEIRO", "ADMINISTRADOR"),
  asyncHandler(disponibilidadesController.atualizar)
);
disponibilidadesRoutes.delete(
  "/:id",
  authMiddleware,
  requireRole("BARBEIRO", "ADMINISTRADOR"),
  asyncHandler(disponibilidadesController.remover)
);
