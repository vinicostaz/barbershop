import type { NextFunction, Request, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error(err);
  return res.status(500).json({ error: "Erro interno do servidor." });
}

// Evita ter que escrever try/catch em todo controller assíncrono.
export function asyncHandler<Params extends ParamsDictionary = ParamsDictionary>(
  fn: (req: Request<Params>, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request<Params>, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
