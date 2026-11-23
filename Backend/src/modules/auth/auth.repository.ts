import { db } from "../../prisma/client.js";

// API clássica do Prisma Client (v7): db.<model em minúsculo>.<método>.

export const authRepository = {
  findByEmail(email: string) {
    return db.usuario.findUnique({ where: { email } });
  },

  create(data: {
    nome: string;
    email: string;
    senhaHash: string;
    telefone?: string;
    role: "CLIENTE" | "BARBEIRO" | "ADMINISTRADOR";
  }) {
    return db.usuario.create({ data });
  },

  findProfileById(id: string) {
    return db.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        role: true,
        pontosFidelidade: true,
        ativo: true,
        criadoEm: true,
      },
    });
  },

  updateProfile(
    id: string,
    data: { nome: string; email: string; telefone: string | null }
  ) {
    return db.usuario.update({
      where: { id },
      data,
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        role: true,
        pontosFidelidade: true,
        ativo: true,
        criadoEm: true,
      },
    });
  },
};
