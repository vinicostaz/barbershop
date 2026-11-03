import { db } from "../../prisma/client.js";

export const disponibilidadesRepository = {
  findByBarbeiro(barbeiroId: string) {
    return db.disponibilidade.findMany({
      where: { barbeiroId },
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    });
  },

  findById(id: string) {
    return db.disponibilidade.findUnique({ where: { id } });
  },

  findSobreposta(
    barbeiroId: string,
    diaSemana: number,
    horaInicio: string,
    horaFim: string,
    ignorarId?: string
  ) {
    return db.disponibilidade.findFirst({
      where: {
        barbeiroId,
        diaSemana,
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
        horaInicio: { lt: horaFim },
        horaFim: { gt: horaInicio },
      },
    });
  },

  // agendamentos confirmados que ainda não terminaram (o histórico não importa
  // para saber se uma mudança de expediente deixa alguém de fora)
  findAgendamentosConfirmadosFuturos(barbeiroId: string, agora: Date) {
    return db.agendamento.findMany({
      where: { barbeiroId, status: "CONFIRMADO", horaFim: { gt: agora } },
      select: { horaInicio: true, horaFim: true },
    });
  },

  create(data: { barbeiroId: string; diaSemana: number; horaInicio: string; horaFim: string }) {
    return db.disponibilidade.create({ data });
  },

  // cria vários de uma vez, numa única transação (ou todos, ou nenhum)
  createVarios(
    data: { barbeiroId: string; diaSemana: number; horaInicio: string; horaFim: string }[]
  ) {
    return db.$transaction(data.map((item) => db.disponibilidade.create({ data: item })));
  },

  update(id: string, data: Partial<{ diaSemana: number; horaInicio: string; horaFim: string }>) {
    return db.disponibilidade.update({ where: { id }, data });
  },

  delete(id: string) {
    return db.disponibilidade.delete({ where: { id } });
  },
};
