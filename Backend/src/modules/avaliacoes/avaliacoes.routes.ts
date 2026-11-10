import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { avaliacoesController } from "./avaliacoes.controller.js";

export const avaliacoesRoutes = Router();

// Avaliações de um barbeiro, com média e total (público: o cliente consulta antes de agendar)
avaliacoesRoutes.get("/barbeiros/:barbeiroId", asyncHandler(avaliacoesController.listarPorBarbeiro));

// Avaliações feitas pelo cliente logado
avaliacoesRoutes.get("/minhas", authMiddleware, asyncHandler(avaliacoesController.listarMinhas));

// Cliente avalia um atendimento concluído (uma vez por atendimento)
avaliacoesRoutes.post("/", authMiddleware, asyncHandler(avaliacoesController.avaliar));
