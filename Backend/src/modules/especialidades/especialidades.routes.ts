import { Router } from "express";
import { authMiddleware, requireRole } from "../../middlewares/authMiddleware.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { especialidadesController } from "./especialidades.controller.js";

export const especialidadesRoutes = Router();

// UC04 - Consultar profissionais / especialidades (público)
especialidadesRoutes.get("/", asyncHandler(especialidadesController.listar));
especialidadesRoutes.get("/:id", asyncHandler(especialidadesController.buscarPorId));

// UC19 - Gerenciar especialidades (somente Administrador)
especialidadesRoutes.post(
  "/",
  authMiddleware,
  requireRole("ADMINISTRADOR"),
  asyncHandler(especialidadesController.criar)
);
especialidadesRoutes.put(
  "/:id",
  authMiddleware,
  requireRole("ADMINISTRADOR"),
  asyncHandler(especialidadesController.atualizar)
);
especialidadesRoutes.delete(
  "/:id",
  authMiddleware,
  requireRole("ADMINISTRADOR"),
  asyncHandler(especialidadesController.remover)
);
