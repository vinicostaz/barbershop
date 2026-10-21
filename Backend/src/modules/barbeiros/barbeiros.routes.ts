import { Router } from "express";
import { authMiddleware, requireRole } from "../../middlewares/authMiddleware.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { barbeirosController } from "./barbeiros.controller.js";

export const barbeirosRoutes = Router();

// UC04 - Consultar profissionais (público; só aparecem os ativos)
barbeirosRoutes.get("/", asyncHandler(barbeirosController.listar));

// admin: lista todos, inclusive desativados.
// Precisa vir ANTES de "/:id", senão "todos" seria lido como um id.
barbeirosRoutes.get(
  "/todos",
  authMiddleware,
  requireRole("ADMINISTRADOR"),
  asyncHandler(barbeirosController.listarTodos)
);

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
barbeirosRoutes.patch(
  "/:id/ativo",
  authMiddleware,
  requireRole("ADMINISTRADOR"),
  asyncHandler(barbeirosController.alterarAtivo)
);
