import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { authRepository } from "./auth.repository.js";
import { normalizarEmail } from "../../utils/normalizacao.js";

interface RegisterInput {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  role?: string; // aceito só para recusar tentativas de se cadastrar como outro perfil
}

interface LoginInput {
  email: string;
  senha: string;
}

interface CriarUsuarioAdministrativoInput extends RegisterInput {
  role: "BARBEIRO" | "ADMINISTRADOR";
}

interface AtualizarPerfilInput {
  nome: unknown;
  email: unknown;
  telefone: unknown;
}

function gerarToken(usuario: { id: string; role: string }) {
  return jwt.sign({ sub: usuario.id, role: usuario.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });
}

function validarCadastro(input: RegisterInput) {
  if (typeof input.nome !== "string" || input.nome.trim().length === 0) {
    throw new AppError("O nome é obrigatório.");
  }
  if (typeof input.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new AppError("Informe um e-mail válido.");
  }
  if (typeof input.senha !== "string" || input.senha.length < 6) {
    throw new AppError("A senha deve ter pelo menos 6 caracteres.");
  }
}

export const authService = {
  // UC01 - Cadastrar usuário
  // O cadastro público cria SEMPRE um CLIENTE. Barbeiros são criados por um
  // administrador (POST /barbeiros) e o primeiro administrador vem do seed.
  async registrar(input: RegisterInput) {
    if (input.role !== undefined && input.role !== "CLIENTE") {
      throw new AppError(
        "O cadastro público é apenas para clientes. Barbeiros e administradores são criados por um administrador.",
        403
      );
    }

    validarCadastro(input);

    const email = normalizarEmail(input.email);
    const usuarioExistente = await authRepository.findByEmail(email);
    if (usuarioExistente) {
      throw new AppError("Já existe um usuário cadastrado com este e-mail.", 409);
    }

    const senhaHash = await bcrypt.hash(input.senha, 10);

    const usuario = await authRepository.create({
      nome: input.nome.trim(),
      email,
      senhaHash,
      telefone: input.telefone,
      role: "CLIENTE",
    });

    const token = gerarToken(usuario);
    return { usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role }, token };
  },

  // UC02 - Autenticar usuário
  async login(input: LoginInput) {
    if (typeof input.email !== "string" || typeof input.senha !== "string") {
      throw new AppError("Informe e-mail e senha.");
    }

    const usuario = await authRepository.findByEmail(normalizarEmail(input.email));
    if (!usuario) {
      throw new AppError("E-mail ou senha inválidos.", 401);
    }

    const senhaValida = await bcrypt.compare(input.senha, usuario.senhaHash);
    if (!senhaValida) {
      throw new AppError("E-mail ou senha inválidos.", 401);
    }

    // conta desativada (ex.: barbeiro que saiu da barbearia) não entra mais
    if (!usuario.ativo) {
      throw new AppError("Esta conta está desativada.", 403);
    }

    const token = gerarToken(usuario);
    return { usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role }, token };
  },

  async obterPerfil(usuarioId: string) {
    const usuario = await authRepository.findProfileById(usuarioId);
    if (!usuario) throw new AppError("Usuário não encontrado.", 404);
    return usuario;
  },

  async atualizarPerfil(usuarioId: string, input: AtualizarPerfilInput) {
    if (typeof input.nome !== "string" || input.nome.trim().length < 2) {
      throw new AppError("O nome deve ter pelo menos 2 caracteres.");
    }
    if (
      typeof input.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
    ) {
      throw new AppError("Informe um e-mail válido.");
    }
    if (
      input.telefone !== undefined &&
      input.telefone !== null &&
      typeof input.telefone !== "string"
    ) {
      throw new AppError("Informe um telefone válido.");
    }

    const email = normalizarEmail(input.email);
    const telefone =
      typeof input.telefone === "string" ? input.telefone.trim() || null : null;
    if (telefone && (telefone.length < 8 || telefone.length > 20)) {
      throw new AppError("O telefone deve ter entre 8 e 20 caracteres.");
    }

    const usuarioComEmail = await authRepository.findByEmail(email);
    if (usuarioComEmail && usuarioComEmail.id !== usuarioId) {
      throw new AppError("Já existe um usuário cadastrado com este e-mail.", 409);
    }

    try {
      return await authRepository.updateProfile(usuarioId, {
        nome: input.nome.trim(),
        email,
        telefone,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new AppError("Já existe um usuário cadastrado com este e-mail.", 409);
      }
      throw error;
    }
  },

  async criarUsuarioAdministrativo(input: CriarUsuarioAdministrativoInput) {
    if (input.role !== "BARBEIRO" && input.role !== "ADMINISTRADOR") {
      throw new AppError("O perfil deve ser BARBEIRO ou ADMINISTRADOR.");
    }
    validarCadastro(input);

    const email = normalizarEmail(input.email);
    const existente = await authRepository.findByEmail(email);
    if (existente) {
      throw new AppError("Já existe um usuário cadastrado com este e-mail.", 409);
    }

    const usuario = await authRepository.create({
      nome: input.nome.trim(),
      email,
      senhaHash: await bcrypt.hash(input.senha, 10),
      telefone: input.telefone?.trim() || undefined,
      role: input.role,
    });

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone,
      role: usuario.role,
      ativo: usuario.ativo,
    };
  },
};
