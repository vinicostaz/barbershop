import { Router } from "express";
import { authMiddleware, requireRole } from "../../middlewares/authMiddleware.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { servicosController } from "./servicos.controller.js";

export const servicosRoutes = Router();

// UC03 - Consultar serviços (público, qualquer pessoa pode ver)
servicosRoutes.get("/", asyncHandler(servicosController.listar));
servicosRoutes.get("/:id", asyncHandler(servicosController.buscarPorId));

// UC17 - Gerenciar serviços (somente Administrador)
servicosRoutes.post(
  "/",
  authMiddleware,
  requireRole("ADMINISTRADOR"),
  asyncHandler(servicosController.criar)
);
servicosRoutes.put(
  "/:id",
  authMiddleware,
  requireRole("ADMINISTRADOR"),
  asyncHandler(servicosController.atualizar)
);
servicosRoutes.delete(
  "/:id",
  authMiddleware,
  requireRole("ADMINISTRADOR"),
  asyncHandler(servicosController.remover)
);
