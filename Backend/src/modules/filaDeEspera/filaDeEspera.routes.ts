import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { filaDeEsperaController } from "./filaDeEspera.controller.js";

export const filaDeEsperaRoutes = Router();

filaDeEsperaRoutes.use(authMiddleware); // toda rota da fila exige login

// minhas entradas (cliente) / fila do barbeiro / todas (admin)
filaDeEsperaRoutes.get("/", asyncHandler(filaDeEsperaController.listar));

// UC09 - Entrar na fila de espera
filaDeEsperaRoutes.post("/", asyncHandler(filaDeEsperaController.entrar));

// UC10 - Confirmar horário liberado
filaDeEsperaRoutes.post("/:id/confirmar", asyncHandler(filaDeEsperaController.confirmar));
