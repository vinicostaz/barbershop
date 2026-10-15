import type { AuthPayload } from "../../middlewares/authMiddleware.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { db } from "../../prisma/client.js";
import { filaDeEsperaRepository } from "../filaDeEspera/filaDeEspera.repository.js";
import { filaDeEsperaService } from "../filaDeEspera/filaDeEspera.service.js";
import { servicosRepository } from "../servicos/servicos.repository.js";
import {
  calcularHorario,
  traduzirErroDeConflito,
  validarDisponibilidade,
} from "./agendamentos.horario.js";
import { agendamentosRepository } from "./agendamentos.repository.js";

interface CriarAgendamentoInput {
  barbeiroId: string;
  servicoId: string;
  data: string; // "2026-10-05"
  horaInicio: string; // "09:00"
}

interface ReagendarInput {
  data: string;
  horaInicio: string;
}

// Valida o horário pedido (formato, disponibilidade, conflito e reserva da fila de espera).
// Compartilhada entre criar e reagendar.
async function prepararHorario(params: {
  barbeiroId: string;
  clienteId: string; // quem está agendando (a prioridade da fila é dele?)
  duracaoMin: number;
  data: string;
  horaInicio: string;
  ignorarAgendamentoId?: string;
}) {
  const { horaInicio, horaFim } = calcularHorario(params.data, params.horaInicio, params.duracaoMin);

  await validarDisponibilidade(params.barbeiroId, horaInicio, horaFim);

  // checagem "otimista" de conflito (rápida, evita ir ao banco tentar e falhar)
  const conflito = await agendamentosRepository.findConflitante(
    params.barbeiroId,
    horaInicio,
    horaFim,
    params.ignorarAgendamentoId
  );
  if (conflito) {
    throw new AppError(
      "Esse horário já está ocupado para este barbeiro. Escolha outro horário ou entre na fila de espera.",
      409
    );
  }

  // horário liberado por cancelamento fica reservado, por um tempo, ao cliente da fila
  const reservado = await filaDeEsperaRepository.findPrioridadeAtiva(
    params.barbeiroId,
    horaInicio,
    horaFim,
    params.clienteId
  );
  if (reservado) {
    throw new AppError(
      "Esse horário está reservado temporariamente para um cliente da fila de espera. Tente novamente em alguns minutos.",
      409
    );
  }

  return { horaInicio, horaFim };
}

// Um horário foi liberado (cancelamento ou reagendamento): avisa o próximo da fila.
// Falha aqui NÃO pode desfazer o cancelamento, então só registramos o erro.
async function liberarHorario(barbeiroId: string, horaInicio: Date, horaFim: Date) {
  try {
    await filaDeEsperaService.notificarProximo(barbeiroId, horaInicio, horaFim);
  } catch (err) {
    console.error("Falha ao processar a fila de espera:", err);
  }
}

export const agendamentosService = {
  // UC06 - Realizar agendamento
  async criar(usuarioLogado: AuthPayload, input: CriarAgendamentoInput) {
    if (usuarioLogado.role !== "CLIENTE") {
      throw new AppError("Apenas clientes podem realizar agendamentos.", 403);
    }

    const barbeiro = await db.usuario.findFirst({
      where: { id: input.barbeiroId, role: "BARBEIRO" },
    });
    if (!barbeiro) {
      throw new AppError("Barbeiro não encontrado.", 404);
    }

    const servico = await servicosRepository.findById(input.servicoId);
    if (!servico) {
      throw new AppError("Serviço não encontrado.", 404);
    }

    const { horaInicio, horaFim } = await prepararHorario({
      barbeiroId: input.barbeiroId,
      clienteId: usuarioLogado.sub,
      duracaoMin: servico.duracaoMin,
      data: input.data,
      horaInicio: input.horaInicio,
    });

    return agendamentosRepository
      .create({
        clienteId: usuarioLogado.sub,
        barbeiroId: input.barbeiroId,
        servicoId: input.servicoId,
        data: horaInicio,
        horaInicio,
        horaFim,
      })
      .catch((err: unknown) => traduzirErroDeConflito(err));
  },

  // UC08 - Reagendar atendimento (mesmo barbeiro e serviço, novo dia/horário)
  async reagendar(usuarioLogado: AuthPayload, id: string, input: ReagendarInput) {
    const agendamento = await agendamentosRepository.findById(id);
    if (!agendamento) {
      throw new AppError("Agendamento não encontrado.", 404);
    }

    const ehDono = agendamento.clienteId === usuarioLogado.sub;
    const ehAdministrador = usuarioLogado.role === "ADMINISTRADOR";
    if (!ehDono && !ehAdministrador) {
      throw new AppError("Você não tem permissão para reagendar este agendamento.", 403);
    }

    if (agendamento.status !== "CONFIRMADO") {
      throw new AppError("Apenas agendamentos confirmados podem ser reagendados.", 400);
    }

    const { horaInicio, horaFim } = await prepararHorario({
      barbeiroId: agendamento.barbeiroId,
      clienteId: agendamento.clienteId,
      duracaoMin: agendamento.servico.duracaoMin,
      data: input.data,
      horaInicio: input.horaInicio,
      ignorarAgendamentoId: id, // não conflitar com o próprio agendamento
    });

    const novo = await agendamentosRepository
      .reagendar(id, {
        clienteId: agendamento.clienteId,
        barbeiroId: agendamento.barbeiroId,
        servicoId: agendamento.servicoId,
        data: horaInicio,
        horaInicio,
        horaFim,
      })
      .catch((err: unknown) => traduzirErroDeConflito(err));

    // o horário antigo ficou livre: avisa o próximo da fila
    await liberarHorario(agendamento.barbeiroId, agendamento.horaInicio, agendamento.horaFim);
    return novo;
  },

  // UC07 - Cancelar agendamento
  async cancelar(usuarioLogado: AuthPayload, id: string) {
    const agendamento = await agendamentosRepository.findById(id);
    if (!agendamento) {
      throw new AppError("Agendamento não encontrado.", 404);
    }

    const ehDono =
      agendamento.clienteId === usuarioLogado.sub || agendamento.barbeiroId === usuarioLogado.sub;
    const ehAdministrador = usuarioLogado.role === "ADMINISTRADOR";
    if (!ehDono && !ehAdministrador) {
      throw new AppError("Você não tem permissão para cancelar este agendamento.", 403);
    }

    if (agendamento.status !== "CONFIRMADO") {
      throw new AppError("Este agendamento não pode mais ser cancelado.", 400);
    }

    const cancelado = await agendamentosRepository.updateStatus(id, "CANCELADO");

    // o horário ficou livre: avisa o próximo da fila
    await liberarHorario(agendamento.barbeiroId, agendamento.horaInicio, agendamento.horaFim);
    return cancelado;
  },

  // UC11 / UC16 - histórico do cliente e agenda do barbeiro, com o mesmo endpoint
  listarParaUsuarioLogado(usuarioLogado: AuthPayload) {
    if (usuarioLogado.role === "CLIENTE") {
      return agendamentosRepository.findByCliente(usuarioLogado.sub);
    }
    if (usuarioLogado.role === "BARBEIRO") {
      return agendamentosRepository.findByBarbeiro(usuarioLogado.sub);
    }
    return agendamentosRepository.findAll();
  },
};
