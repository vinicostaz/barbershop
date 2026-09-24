import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { authRepository } from "./auth.repository.js";

interface RegisterInput {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  role: "CLIENTE" | "BARBEIRO" | "ADMINISTRADOR";
}

interface LoginInput {
  email: string;
  senha: string;
}

function gerarToken(usuario: { id: string; role: string }) {
  return jwt.sign({ sub: usuario.id, role: usuario.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export const authService = {
  async registrar(input: RegisterInput) {
    const usuarioExistente = await authRepository.findByEmail(input.email);
    if (usuarioExistente) {
      throw new AppError("Já existe um usuário cadastrado com este e-mail.", 409);
    }

    const senhaHash = await bcrypt.hash(input.senha, 10);

    const usuario = await authRepository.create({
      nome: input.nome,
      email: input.email,
      senhaHash,
      telefone: input.telefone,
      role: input.role,
    });

    const token = gerarToken(usuario);
    return { usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role }, token };
  },

  async login(input: LoginInput) {
    const usuario = await authRepository.findByEmail(input.email);
    if (!usuario) {
      throw new AppError("E-mail ou senha inválidos.", 401);
    }

    const senhaValida = await bcrypt.compare(input.senha, usuario.senhaHash);
    if (!senhaValida) {
      throw new AppError("E-mail ou senha inválidos.", 401);
    }

    const token = gerarToken(usuario);
    return { usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role }, token };
  },
};
