import { Router } from "express";
import { authMiddleware, requireRole } from "../../middlewares/authMiddleware.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { barbeirosController } from "./barbeiros.controller.js";

export const barbeirosRoutes = Router();

// UC04 - Consultar profissionais (público)
barbeirosRoutes.get("/", asyncHandler(barbeirosController.listar));
barbeirosRoutes.get("/:id", asyncHandler(barbeirosController.buscarPorId));

// UC18 - Gerenciar profissionais (somente Administrador)
barbeirosRoutes.post(
  "/",
  authMiddleware,
  requireRole("ADMINISTRADOR"),
  asyncHandler(barbeirosController.criar)
);
barbeirosRoutes.put(
  "/:id",
  authMiddleware,
  requireRole("ADMINISTRADOR"),
  asyncHandler(barbeirosController.atualizar)
);
barbeirosRoutes.put(
  "/:id/especialidades",
  authMiddleware,
  requireRole("ADMINISTRADOR"),
  asyncHandler(barbeirosController.atualizarEspecialidades)
);
