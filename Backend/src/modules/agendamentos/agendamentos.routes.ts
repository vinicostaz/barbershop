import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { agendamentosController } from "./agendamentos.controller.js";

export const agendamentosRoutes = Router();

agendamentosRoutes.use(authMiddleware); // toda rota de agendamento exige login

// UC11/UC16 - histórico (cliente) / agenda (barbeiro) / todos (admin)
agendamentosRoutes.get("/", asyncHandler(agendamentosController.listar));

// UC06 - Realizar agendamento
agendamentosRoutes.post("/", asyncHandler(agendamentosController.criar));

// UC07 - Cancelar agendamento
agendamentosRoutes.patch("/:id/cancelar", asyncHandler(agendamentosController.cancelar));
