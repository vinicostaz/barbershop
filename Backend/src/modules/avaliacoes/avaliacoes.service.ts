import type { AuthPayload } from "../../middlewares/authMiddleware.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { db } from "../../prisma/client.js";
import { avaliacoesRepository } from "./avaliacoes.repository.js";

export const NOTA_MINIMA = 1;
export const NOTA_MAXIMA = 5;
export const COMENTARIO_MAXIMO = 500;

interface AvaliarInput {
  agendamentoId: unknown;
  nota: unknown;
  comentario?: unknown;
}

// Valida e normaliza o corpo da avaliação: nota inteira de 1 a 5 e comentário
// opcional (espaços nas pontas são removidos; comentário vazio vira "sem comentário").
export function validarAvaliacao(input: AvaliarInput) {
  if (typeof input.agendamentoId !== "string" || !input.agendamentoId) {
    throw new AppError("agendamentoId é obrigatório.");
  }
  if (
    typeof input.nota !== "number" ||
    !Number.isInteger(input.nota) ||
    input.nota < NOTA_MINIMA ||
    input.nota > NOTA_MAXIMA
  ) {
    throw new AppError(`nota deve ser um número inteiro de ${NOTA_MINIMA} a ${NOTA_MAXIMA}.`);
  }

  let comentario: string | undefined;
  if (input.comentario !== undefined && input.comentario !== null) {
    if (typeof input.comentario !== "string") {
      throw new AppError("comentario deve ser um texto.");
    }
    comentario = input.comentario.trim() || undefined;
    if (comentario && comentario.length > COMENTARIO_MAXIMO) {
      throw new AppError(`comentario pode ter no máximo ${COMENTARIO_MAXIMO} caracteres.`);
    }
  }

  return { agendamentoId: input.agendamentoId, nota: input.nota, comentario };
}

// agendamentoId é @unique em avaliacoes: se duas avaliações do mesmo atendimento
// chegarem juntas, o banco barra a segunda (P2002 / 23505)
function ehAvaliacaoDuplicada(err: unknown) {
  const e = err as { code?: unknown; cause?: { originalCode?: unknown } } | null;
  return e?.code === "P2002" || e?.cause?.originalCode === "23505";
}

const MENSAGEM_JA_AVALIADO = "Este atendimento já foi avaliado.";

export const avaliacoesService = {
  // Cliente avalia um atendimento CONCLUÍDO que é dele, uma única vez.
  async avaliar(usuarioLogado: AuthPayload, input: AvaliarInput) {
    if (usuarioLogado.role !== "CLIENTE") {
      throw new AppError("Apenas clientes podem avaliar atendimentos.", 403);
    }
    const dados = validarAvaliacao(input);

    const agendamento = await avaliacoesRepository.findAgendamento(dados.agendamentoId);
    if (!agendamento) {
      throw new AppError("Agendamento não encontrado.", 404);
    }
    if (agendamento.clienteId !== usuarioLogado.sub) {
      throw new AppError("Você só pode avaliar os seus próprios atendimentos.", 403);
    }
    if (agendamento.status !== "CONCLUIDO") {
      throw new AppError("Só é possível avaliar um atendimento depois de concluído.", 400);
    }
    if (agendamento.avaliacao) {
      throw new AppError(MENSAGEM_JA_AVALIADO, 409);
    }

    return avaliacoesRepository
      .create({ ...dados, clienteId: usuarioLogado.sub })
      .catch((err: unknown) => {
        if (ehAvaliacaoDuplicada(err)) throw new AppError(MENSAGEM_JA_AVALIADO, 409);
        throw err;
      });
  },

  // Público: o cliente vê a nota do barbeiro antes de agendar.
  async listarPorBarbeiro(barbeiroId: string) {
    const barbeiro = await db.usuario.findFirst({
      where: { id: barbeiroId, role: "BARBEIRO" },
      select: { id: true },
    });
    if (!barbeiro) {
      throw new AppError("Barbeiro não encontrado.", 404);
    }

    const [resumo, avaliacoes] = await Promise.all([
      avaliacoesRepository.resumoDoBarbeiro(barbeiroId),
      avaliacoesRepository.findByBarbeiro(barbeiroId),
    ]);
    const media = resumo._avg.nota;

    return {
      // média com 1 casa decimal (4.666… => 4.7); null quando ainda não há avaliações
      media: media === null ? null : Math.round(media * 10) / 10,
      total: resumo._count._all,
      avaliacoes: avaliacoes.map((avaliacao) => ({
        id: avaliacao.id,
        nota: avaliacao.nota,
        comentario: avaliacao.comentario,
        criadoEm: avaliacao.criadoEm,
        cliente: avaliacao.cliente.nome,
        servico: avaliacao.agendamento.servico.nome,
      })),
    };
  },

  listarMinhas(usuarioLogado: AuthPayload) {
    if (usuarioLogado.role !== "CLIENTE") {
      throw new AppError("Apenas clientes possuem avaliações feitas.", 403);
    }
    return avaliacoesRepository.findByCliente(usuarioLogado.sub);
  },
};
