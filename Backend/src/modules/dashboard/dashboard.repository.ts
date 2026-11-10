import { db } from "../../prisma/client.js";

const pessoaResumo = { select: { id: true, nome: true } } as const;

export const dashboardRepository = {
  buscarAgendamentosDoPeriodo(inicio: Date, fim: Date) {
    return db.agendamento.findMany({
      where: { horaInicio: { gte: inicio, lt: fim } },
      include: {
        avaliacao: { select: { nota: true } },
        barbeiro: pessoaResumo,
        cliente: pessoaResumo,
        servico: { select: { id: true, nome: true, preco: true } },
      },
      orderBy: { horaInicio: "asc" },
    });
  },

  buscarProximosAgendamentos(agora: Date, limite: number) {
    return db.agendamento.findMany({
      where: { status: "CONFIRMADO", horaInicio: { gte: agora } },
      include: {
        barbeiro: pessoaResumo,
        cliente: pessoaResumo,
        servico: { select: { id: true, nome: true } },
      },
      orderBy: { horaInicio: "asc" },
      take: limite,
    });
  },

  contarClientesCriados(inicio: Date, fim: Date) {
    return db.usuario.count({
      where: { role: "CLIENTE", criadoEm: { gte: inicio, lt: fim } },
    });
  },

  buscarProfissionaisAtivos() {
    return db.usuario.findMany({
      where: { role: "BARBEIRO", ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
  },

  contarServicos() {
    return db.servico.count();
  },
};
