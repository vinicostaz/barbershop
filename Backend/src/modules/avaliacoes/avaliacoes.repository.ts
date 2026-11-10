import { db } from "../../prisma/client.js";

export const avaliacoesRepository = {
  findAgendamento(agendamentoId: string) {
    return db.agendamento.findUnique({
      where: { id: agendamentoId },
      select: { id: true, clienteId: true, barbeiroId: true, status: true, avaliacao: { select: { id: true } } },
    });
  },

  create(data: { agendamentoId: string; clienteId: string; nota: number; comentario?: string }) {
    return db.avaliacao.create({ data });
  },

  // avaliações recebidas por um barbeiro (através dos agendamentos dele), mais recentes primeiro.
  // Do cliente só sai o nome: e-mail, telefone etc. não são expostos.
  findByBarbeiro(barbeiroId: string) {
    return db.avaliacao.findMany({
      where: { agendamento: { barbeiroId } },
      select: {
        id: true,
        nota: true,
        comentario: true,
        criadoEm: true,
        cliente: { select: { nome: true } },
        agendamento: { select: { servico: { select: { nome: true } } } },
      },
      orderBy: { criadoEm: "desc" },
    });
  },

  resumoDoBarbeiro(barbeiroId: string) {
    return db.avaliacao.aggregate({
      where: { agendamento: { barbeiroId } },
      _avg: { nota: true },
      _count: { _all: true },
    });
  },

  findByCliente(clienteId: string) {
    return db.avaliacao.findMany({
      where: { clienteId },
      include: {
        agendamento: {
          select: {
            id: true,
            horaInicio: true,
            barbeiro: { select: { id: true, nome: true } },
            servico: { select: { nome: true } },
          },
        },
      },
      orderBy: { criadoEm: "desc" },
    });
  },
};
