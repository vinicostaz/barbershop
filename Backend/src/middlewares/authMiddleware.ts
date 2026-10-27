import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errorHandler.js";
import { db } from "../prisma/client.js";

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

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("Token de autenticação ausente.", 401);
  }

  const token = authHeader.replace("Bearer ", "");

  let payload: Partial<AuthPayload>;
  try {
    payload = jwt.verify(token, env.jwtSecret) as Partial<AuthPayload>;
  } catch {
    throw new AppError("Token inválido ou expirado.", 401);
  }

  if (typeof payload.sub !== "string") {
    throw new AppError("Token inválido ou expirado.", 401);
  }

  const usuario = await db.usuario.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, ativo: true },
  });
  if (!usuario?.ativo) {
    throw new AppError("Esta conta está desativada.", 401);
  }

  req.user = { sub: usuario.id, role: usuario.role };
  next();
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
