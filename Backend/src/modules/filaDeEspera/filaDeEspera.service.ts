import type { AuthPayload } from "../../middlewares/authMiddleware.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { db } from "../../prisma/client.js";
import {
  calcularHorario,
  traduzirErroDeConflito,
  validarDisponibilidade,
} from "../agendamentos/agendamentos.horario.js";
import { agendamentosRepository } from "../agendamentos/agendamentos.repository.js";
import { agoraComoHoraDeParede } from "../agendamentos/agendamentos.tempo.js";
import { formatarHora } from "../agendamentos/agendamentos.utils.js";
import { servicosRepository } from "../servicos/servicos.repository.js";
import { filaDeEsperaRepository } from "./filaDeEspera.repository.js";

// Quanto tempo o cliente avisado tem de prioridade para confirmar a vaga.
// Para testar a expiração, coloque FILA_PRIORIDADE_MIN=1 no .env.
const PRIORIDADE_MINUTOS = Number(process.env.FILA_PRIORIDADE_MIN ?? 15);

interface EntrarNaFilaInput {
  barbeiroId: string;
  servicoId: string;
  data: string; // "2026-10-12"
  horaInicio: string; // "10:00"
}

function formatarDataHoraBR(data: Date) {
  const [ano, mes, dia] = data.toISOString().slice(0, 10).split("-");
  return `${dia}/${mes}/${ano} às ${formatarHora(data)}`;
}

export const filaDeEsperaService = {
  // UC09 - Entrar na fila de espera (de um horário que está ocupado)
  async entrar(usuarioLogado: AuthPayload, input: EntrarNaFilaInput) {
    if (usuarioLogado.role !== "CLIENTE") {
      throw new AppError("Apenas clientes podem entrar na fila de espera.", 403);
    }

    const barbeiro = await db.usuario.findFirst({
      where: { id: input.barbeiroId, role: "BARBEIRO" },
    });
    if (!barbeiro) {
      throw new AppError("Barbeiro não encontrado.", 404);
    }
    if (!barbeiro.ativo) {
      throw new AppError("Este barbeiro não está mais atendendo.", 400);
    }

    const servico = await servicosRepository.findById(input.servicoId);
    if (!servico) {
      throw new AppError("Serviço não encontrado.", 404);
    }

    const { horaInicio, horaFim } = calcularHorario(input.data, input.horaInicio, servico.duracaoMin);
    await validarDisponibilidade(input.barbeiroId, horaInicio, horaFim);

    // só faz sentido entrar na fila se o horário está de fato ocupado
    // (por um agendamento ou por uma prioridade temporária de outro cliente)
    const conflito = await agendamentosRepository.findConflitante(
      input.barbeiroId,
      horaInicio,
      horaFim
    );
    const reservado = await filaDeEsperaRepository.findPrioridadeAtiva(
      input.barbeiroId,
      horaInicio,
      horaFim,
      usuarioLogado.sub
    );
    if (!conflito && !reservado) {
      throw new AppError("Este horário está livre. Faça o agendamento diretamente.", 400);
    }
    if (conflito && conflito.clienteId === usuarioLogado.sub) {
      throw new AppError("Você já possui um agendamento neste horário.", 400);
    }

    const duplicada = await filaDeEsperaRepository.findDuplicada(
      usuarioLogado.sub,
      input.barbeiroId,
      horaInicio
    );
    if (duplicada) {
      throw new AppError("Você já está na fila de espera para este horário.", 409);
    }

    return filaDeEsperaRepository.create({
      clienteId: usuarioLogado.sub,
      barbeiroId: input.barbeiroId,
      servicoId: input.servicoId,
      horaInicio,
      horaFim,
    });
  },

  // UC10 - Confirmar horário liberado
  // Não agenda automaticamente: o cliente avisado precisa confirmar dentro do prazo.
  async confirmar(usuarioLogado: AuthPayload, id: string) {
    const entrada = await filaDeEsperaRepository.findById(id);
    if (!entrada) {
      throw new AppError("Entrada na fila de espera não encontrada.", 404);
    }
    if (entrada.clienteId !== usuarioLogado.sub) {
      throw new AppError("Você não tem permissão para confirmar esta vaga.", 403);
    }
    if (entrada.status === "AGUARDANDO") {
      throw new AppError("Nenhum horário foi liberado para você ainda.", 400);
    }
    if (entrada.status !== "NOTIFICADO") {
      throw new AppError("Esta entrada na fila de espera não está mais ativa.", 400);
    }

    // expiração "preguiçosa": detectada quando o cliente tenta confirmar
    if (!entrada.expiraEm || entrada.expiraEm.getTime() < Date.now()) {
      await filaDeEsperaRepository.marcarExpirado(entrada.id, entrada.clienteId);
      await this.notificarProximo(entrada.barbeiroId, entrada.horaInicio, entrada.horaFim);
      throw new AppError("O prazo para confirmar este horário expirou.", 410);
    }

    // o horário pode ter passado enquanto o cliente decidia
    if (entrada.horaInicio.getTime() < agoraComoHoraDeParede().getTime()) {
      await filaDeEsperaRepository.marcarExpirado(entrada.id, entrada.clienteId);
      throw new AppError("Esse horário já passou.", 410);
    }

    await validarDisponibilidade(entrada.barbeiroId, entrada.horaInicio, entrada.horaFim);

    const conflito = await agendamentosRepository.findConflitante(
      entrada.barbeiroId,
      entrada.horaInicio,
      entrada.horaFim
    );
    if (conflito) {
      throw new AppError("Esse horário não está mais disponível.", 409);
    }

    return filaDeEsperaRepository
      .confirmar(entrada.id, {
        clienteId: entrada.clienteId,
        barbeiroId: entrada.barbeiroId,
        servicoId: entrada.servicoId,
        data: entrada.horaInicio,
        horaInicio: entrada.horaInicio,
        horaFim: entrada.horaFim,
      })
      .catch((err: unknown) => traduzirErroDeConflito(err));
  },

  listar(usuarioLogado: AuthPayload) {
    if (usuarioLogado.role === "CLIENTE") {
      return filaDeEsperaRepository.findByCliente(usuarioLogado.sub);
    }
    if (usuarioLogado.role === "BARBEIRO") {
      return filaDeEsperaRepository.findByBarbeiro(usuarioLogado.sub);
    }
    return filaDeEsperaRepository.findAll();
  },

  // Gatilho: chamado quando um horário é liberado (cancelamento ou reagendamento).
  // Avisa o primeiro da fila (por ordem de chegada) cujo horário agora está livre.
  async notificarProximo(barbeiroId: string, horaInicio: Date, horaFim: Date) {
    // 1) quem foi avisado antes e deixou o prazo passar perde a prioridade
    const vencidos = await filaDeEsperaRepository.findVencidos(barbeiroId, horaInicio, horaFim);
    for (const vencido of vencidos) {
      await filaDeEsperaRepository.marcarExpirado(vencido.id, vencido.clienteId);
    }

    // 2) se alguém ainda tem prioridade válida nesse horário, ninguém mais é avisado
    const prioridadeAtiva = await filaDeEsperaRepository.findPrioridadeAtiva(
      barbeiroId,
      horaInicio,
      horaFim
    );
    if (prioridadeAtiva) {
      return null;
    }

    // 3) primeiro da fila cujo horário desejado está realmente livre
    const candidatos = await filaDeEsperaRepository.findAguardando(barbeiroId, horaInicio, horaFim);
    const agora = agoraComoHoraDeParede();
    for (const candidato of candidatos) {
      if (candidato.horaInicio.getTime() < agora.getTime()) continue; // horário que já passou
      const conflito = await agendamentosRepository.findConflitante(
        barbeiroId,
        candidato.horaInicio,
        candidato.horaFim
      );
      if (conflito) continue;

      const expiraEm = new Date(Date.now() + PRIORIDADE_MINUTOS * 60_000);
      const mensagem =
        `O horário de ${formatarDataHoraBR(candidato.horaInicio)} com ${candidato.barbeiro.nome} ` +
        `ficou disponível. Você tem ${PRIORIDADE_MINUTOS} minutos para confirmar.`;

      return filaDeEsperaRepository.marcarNotificado(
        candidato.id,
        candidato.clienteId,
        expiraEm,
        mensagem
      );
    }

    return null;
  },
};
