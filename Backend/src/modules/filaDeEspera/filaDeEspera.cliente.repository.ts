import { db } from "../../prisma/client.js";
import { usuarioSemSenha } from "../../prisma/usuarioSemSenha.js";

// Consultas novas da fila de espera para o CLIENTE (posição, horários elegíveis, desistência).
// Ficam num arquivo à parte para não mexer em filaDeEspera.repository.ts.

// duas faixas [A,B) e [C,D) se sobrepõem quando A < D e C < B
const sobrepoe = (inicio: Date, fim: Date) => ({ horaInicio: { lt: fim }, horaFim: { gt: inicio } });

export const filaClienteRepository = {
  // --- consultas de apoio (feitas aqui para este arquivo não depender de outros módulos) ---

  // só barbeiro ATIVO: desativado não é oferecido
  findBarbeiroAtivo(id: string) {
    return db.usuario.findFirst({ where: { id, role: "BARBEIRO", ativo: true }, select: { id: true } });
  },

  findServico(id: string) {
    return db.servico.findUnique({ where: { id }, select: { duracaoMin: true } });
  },

  // períodos que o barbeiro bloqueou (folga, férias etc.)
  findBloqueiosNoPeriodo(barbeiroId: string, inicio: Date, fim: Date) {
    return db.bloqueioPeriodo.findMany({
      where: { barbeiroId, inicio: { lt: fim }, fim: { gt: inicio } },
      select: { inicio: true, fim: true },
    });
  },

  // horários liberados por cancelamento e reservados (por alguns minutos) a um cliente da fila
  findPrioridadesAtivasNoPeriodo(barbeiroId: string, inicio: Date, fim: Date) {
    return db.filaDeEspera.findMany({
      where: { barbeiroId, status: "NOTIFICADO", expiraEm: { gt: new Date() }, ...sobrepoe(inicio, fim) },
      select: { horaInicio: true, horaFim: true },
    });
  },

  // --- fila do cliente ---

  // todas as entradas do cliente, com barbeiro (sem senhaHash) e serviço
  findDoCliente(clienteId: string) {
    return db.filaDeEspera.findMany({
      where: { clienteId },
      include: { barbeiro: usuarioSemSenha, servico: true },
      orderBy: { criadoEm: "desc" },
    });
  },

  findById(id: string) {
    return db.filaDeEspera.findUnique({ where: { id } });
  },

  // AGUARDANDO de um horário que já passou não tem mais como ser atendido
  expirarAguardandoPassadas(clienteId: string, agoraDeParede: Date) {
    return db.filaDeEspera.updateMany({
      where: { clienteId, status: "AGUARDANDO", horaInicio: { lt: agoraDeParede } },
      data: { status: "EXPIRADO" },
    });
  },

  // o cliente foi avisado (NOTIFICADO) e deixou o prazo passar
  findVencidosDoCliente(clienteId: string) {
    return db.filaDeEspera.findMany({
      where: { clienteId, status: "NOTIFICADO", expiraEm: { lt: new Date() } },
    });
  },

  findAguardandoDoCliente(clienteId: string) {
    return db.filaDeEspera.findMany({ where: { clienteId, status: "AGUARDANDO" } });
  },

  // Quantas entradas ATIVAS estão na frente desta: mesmo barbeiro, horário que se sobrepõe,
  // entraram antes (empate no instante: desempata pelo id). NOTIFICADO com prazo vencido
  // não conta como ativa.
  contarNaFrente(entrada: { id: string; barbeiroId: string; horaInicio: Date; horaFim: Date; criadoEm: Date }) {
    return db.filaDeEspera.count({
      where: {
        barbeiroId: entrada.barbeiroId,
        id: { not: entrada.id },
        ...sobrepoe(entrada.horaInicio, entrada.horaFim),
        AND: [
          { OR: [{ status: "AGUARDANDO" }, { status: "NOTIFICADO", expiraEm: { gt: new Date() } }] },
          { OR: [{ criadoEm: { lt: entrada.criadoEm } }, { criadoEm: entrada.criadoEm, id: { lt: entrada.id } }] },
        ],
      },
    });
  },

  // entradas ativas do próprio cliente com este barbeiro no período
  findAtivasDoClienteNoPeriodo(clienteId: string, barbeiroId: string, inicio: Date, fim: Date) {
    return db.filaDeEspera.findMany({
      where: { clienteId, barbeiroId, status: { in: ["AGUARDANDO", "NOTIFICADO"] }, ...sobrepoe(inicio, fim) },
      select: { horaInicio: true },
    });
  },

  // agendamentos confirmados no período, COM o dono (só para a regra; o dono nunca vai para a resposta)
  findConfirmadosComClienteNoPeriodo(barbeiroId: string, inicio: Date, fim: Date) {
    return db.agendamento.findMany({
      where: { barbeiroId, status: "CONFIRMADO", ...sobrepoe(inicio, fim) },
      select: { horaInicio: true, horaFim: true, clienteId: true },
    });
  },

  marcarDesistiu(id: string) {
    return db.filaDeEspera.update({ where: { id }, data: { status: "DESISTIU" } });
  },
};

// Cria a entrada DENTRO de uma trava por (cliente, barbeiro, horário). Sem isso, duas requisições
// simultâneas do mesmo cliente passam juntas pela checagem de duplicidade e criam duas entradas.
// Devolve null se o cliente já tem uma entrada ativa para esse horário.
export async function criarEntradaSeNaoDuplicada(dados: {
  clienteId: string;
  barbeiroId: string;
  servicoId: string;
  horaInicio: Date;
  horaFim: Date;
}) {
  return db.$transaction(async (tx) => {
    const chave = `fila:${dados.clienteId}:${dados.barbeiroId}:${dados.horaInicio.toISOString()}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${chave}, 0))`;

    const duplicada = await tx.filaDeEspera.findFirst({
      where: {
        clienteId: dados.clienteId,
        barbeiroId: dados.barbeiroId,
        horaInicio: dados.horaInicio,
        status: { in: ["AGUARDANDO", "NOTIFICADO"] },
      },
    });
    if (duplicada) return null;

    return tx.filaDeEspera.create({
      data: dados,
      include: { cliente: usuarioSemSenha, barbeiro: usuarioSemSenha, servico: true },
    });
  });
}
