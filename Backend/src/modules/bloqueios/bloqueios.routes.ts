import { Router } from "express";
import { authMiddleware, requireRole } from "../../middlewares/authMiddleware.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { bloqueiosController } from "./bloqueios.controller.js";

export const bloqueiosRoutes = Router();

// Bloqueio de períodos (RF-003): só o próprio Barbeiro ou um Administrador
bloqueiosRoutes.use(authMiddleware, requireRole("BARBEIRO", "ADMINISTRADOR"));

bloqueiosRoutes.get("/barbeiros/:barbeiroId", asyncHandler(bloqueiosController.listarPorBarbeiro));
bloqueiosRoutes.post("/barbeiros/:barbeiroId", asyncHandler(bloqueiosController.criar));
bloqueiosRoutes.delete("/:id", asyncHandler(bloqueiosController.remover));
