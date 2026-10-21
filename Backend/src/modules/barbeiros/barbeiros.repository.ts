import { db } from "../../prisma/client.js";
import { usuarioSemSenha } from "../../prisma/usuarioSemSenha.js";

const includeEspecialidades = {
  especialidades: { include: { especialidade: true } },
} as const;

export const barbeirosRepository = {
  findAll(incluirInativos = false) {
    return db.usuario.findMany({
      where: { role: "BARBEIRO", ...(incluirInativos ? {} : { ativo: true }) },
      include: includeEspecialidades,
      ...usuarioSemSenha,
      orderBy: { nome: "asc" },
    });
  },

  findById(id: string, incluirInativos = false) {
    return db.usuario.findFirst({
      where: { id, role: "BARBEIRO", ...(incluirInativos ? {} : { ativo: true }) },
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

  update(id: string, data: Partial<{ nome: string; telefone: string }>) {
    return db.usuario.update({
      where: { id },
      data,
      include: includeEspecialidades,
      ...usuarioSemSenha,
    });
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
