import { db } from "../../prisma/client.js";

const includeEspecialidades = {
  especialidades: { include: { especialidade: true } },
} as const;

export const barbeirosRepository = {
  findAll() {
    return db.usuario.findMany({
      where: { role: "BARBEIRO" },
      include: includeEspecialidades,
      orderBy: { nome: "asc" },
    });
  },

  findById(id: string) {
    return db.usuario.findFirst({
      where: { id, role: "BARBEIRO" },
      include: includeEspecialidades,
    });
  },

  findByEmail(email: string) {
    return db.usuario.findUnique({ where: { email } });
  },

  create(data: { nome: string; email: string; senhaHash: string; telefone?: string }) {
    return db.usuario.create({
      data: { ...data, role: "BARBEIRO" },
      include: includeEspecialidades,
    });
  },

  update(id: string, data: Partial<{ nome: string; telefone: string }>) {
    return db.usuario.update({
      where: { id },
      data,
      include: includeEspecialidades,
    });
  },

  // substitui o conjunto inteiro de especialidades do barbeiro pelo informado
  setEspecialidades(barbeiroId: string, especialidadeIds: string[]) {
    return db.$transaction([
      db.barbeiroEspecialidade.deleteMany({ where: { barbeiroId } }),
      db.barbeiroEspecialidade.createMany({
        data: especialidadeIds.map((especialidadeId) => ({ barbeiroId, especialidadeId })),
        skipDuplicates: true,
      }),
    ]);
  },
};
