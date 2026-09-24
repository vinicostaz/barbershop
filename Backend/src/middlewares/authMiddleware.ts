import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errorHandler.js";

export interface AuthPayload {
  sub: string; // id do usuário
  role: "CLIENTE" | "BARBEIRO" | "ADMINISTRADOR";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("Token de autenticação ausente.", 401);
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    throw new AppError("Token inválido ou expirado.", 401);
  }
}

// Uso: router.post("/", authMiddleware, requireRole("ADMINISTRADOR"), controller)
export function requireRole(...roles: AuthPayload["role"][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError("Você não tem permissão para acessar este recurso.", 403);
    }
    next();
  };
}
