import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler.js";
import { dashboardService } from "./dashboard.service.js";

export const dashboardController = {
  async resumo(req: Request, res: Response) {
    if (!req.user) throw new AppError("Não autenticado.", 401);
    const resultado = await dashboardService.resumo(req.user, req.query.mes);
    res.set("Cache-Control", "no-store");
    return res.json(resultado);
  },
};
