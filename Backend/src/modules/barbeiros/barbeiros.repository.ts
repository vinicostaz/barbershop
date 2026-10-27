import { db } from "../../prisma/client.js";
import { usuarioSemSenha } from "../../prisma/usuarioSemSenha.js";

const includeEspecialidades = {
  especialidades: { include: { especialidade: true } },
} as const;

const barbeiroPublico = {
  select: {
    id: true,
    nome: true,
    ativo: true,
    especialidades: { include: { especialidade: true } },
  },
} as const;

export const barbeirosRepository = {
  findAll(incluirInativos = false) {
    if (!incluirInativos) {
      return db.usuario.findMany({
        where: { role: "BARBEIRO", ativo: true },
        ...barbeiroPublico,
        orderBy: { nome: "asc" },
      });
    }
    return db.usuario.findMany({
      where: { role: "BARBEIRO" },
      include: includeEspecialidades,
      ...usuarioSemSenha,
      orderBy: { nome: "asc" },
    });
  },

  findById(id: string, incluirInativos = false) {
    if (!incluirInativos) {
      return db.usuario.findFirst({
        where: { id, role: "BARBEIRO", ativo: true },
        ...barbeiroPublico,
      });
    }
    return db.usuario.findFirst({
      where: { id, role: "BARBEIRO" },
      include: includeEspecialidades,
      ...usuarioSemSenha,
    });
  },

  findByEmail(email: string) {
    return db.usuario.findUnique({ where: { email }, ...usuarioSemSenha });
  },

  create(data: { nome: string; email: string; senhaHash: string; telefone?: string }) {
    return db.usuario.create({
      data: { ...data, role: "BARBEIRO" },
      include: includeEspecialidades,
      ...usuarioSemSenha,
    });
  },

  createComEspecialidades(
    data: { nome: string; email: string; senhaHash: string; telefone?: string },
    especialidadeIds: string[]
  ) {
    return db.$transaction(async (tx) => {
      const barbeiro = await tx.usuario.create({ data: { ...data, role: "BARBEIRO" } });
      if (especialidadeIds.length > 0) {
        await tx.barbeiroEspecialidade.createMany({
          data: especialidadeIds.map((especialidadeId) => ({
            barbeiroId: barbeiro.id,
            especialidadeId,
          })),
        });
      }
      return tx.usuario.findUniqueOrThrow({
        where: { id: barbeiro.id },
        include: includeEspecialidades,
        ...usuarioSemSenha,
      });
    });
  },

  update(id: string, data: Partial<{ nome: string; telefone: string }>) {
    return db.usuario.update({
      where: { id },
      data,
      include: includeEspecialidades,
      ...usuarioSemSenha,
    });
  },

  updateComEspecialidades(
    id: string,
    data: Partial<{ nome: string; telefone: string }>,
    especialidadeIds?: string[]
  ) {
    return db.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id }, data });
      if (especialidadeIds !== undefined) {
        await tx.barbeiroEspecialidade.deleteMany({ where: { barbeiroId: id } });
        if (especialidadeIds.length > 0) {
          await tx.barbeiroEspecialidade.createMany({
            data: especialidadeIds.map((especialidadeId) => ({
              barbeiroId: id,
              especialidadeId,
            })),
          });
        }
      }
      return tx.usuario.findUniqueOrThrow({
        where: { id },
        include: includeEspecialidades,
        ...usuarioSemSenha,
      });
    });
  },

  contarEspecialidades(ids: string[]) {
    return db.especialidade.count({ where: { id: { in: ids } } });
  },

  setAtivo(id: string, ativo: boolean) {
    return db.usuario.update({
      where: { id },
      data: { ativo },
      include: includeEspecialidades,
      ...usuarioSemSenha,
    });
  },

  // agendamentos confirmados que ainda não terminaram (impedem desativar o barbeiro)
  contarAgendamentosFuturos(barbeiroId: string, agora: Date) {
    return db.agendamento.count({
      where: { barbeiroId, status: "CONFIRMADO", horaFim: { gt: agora } },
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
