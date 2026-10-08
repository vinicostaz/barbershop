import type { AuthPayload } from "../../middlewares/authMiddleware.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { db } from "../../prisma/client.js";
import { disponibilidadesRepository } from "../disponibilidades/disponibilidades.repository.js";
import { servicosRepository } from "../servicos/servicos.repository.js";
import { agendamentosRepository } from "./agendamentos.repository.js";
import {
  adicionarMinutos,
  combinarDataHora,
  diaDaSemana,
  formatarHora,
} from "./agendamentos.utils.js";

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

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

// Valida o horário pedido (formato, disponibilidade do barbeiro e conflito).
// Compartilhada entre criar e reagendar.
async function prepararHorario(params: {
  barbeiroId: string;
  duracaoMin: number;
  data: string;
  horaInicio: string;
  ignorarAgendamentoId?: string;
}) {
  if (!DATA_REGEX.test(params.data ?? "")) {
    throw new AppError("data deve estar no formato AAAA-MM-DD.");
  }
  if (!HORA_REGEX.test(params.horaInicio ?? "")) {
    throw new AppError("horaInicio deve estar no formato HH:mm.");
  }

  const horaInicio = combinarDataHora(params.data, params.horaInicio);
  const horaFim = adicionarMinutos(horaInicio, params.duracaoMin);

  // 1) o horário pedido precisa caber dentro de algum bloco de disponibilidade do barbeiro
  const disponibilidades = await disponibilidadesRepository.findByBarbeiro(params.barbeiroId);
  const diaSemana = diaDaSemana(params.data);
  const cabeNaDisponibilidade = disponibilidades.some(
    (d) =>
      d.diaSemana === diaSemana &&
      formatarHora(horaInicio) >= d.horaInicio &&
      formatarHora(horaFim) <= d.horaFim
  );
  if (!cabeNaDisponibilidade) {
    throw new AppError("O horário escolhido está fora da disponibilidade do barbeiro.", 400);
  }

  // 2) checagem "otimista" de conflito (rápida, evita ir ao banco tentar e falhar)
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

  return { horaInicio, horaFim };
}

// 3) checagem "definitiva": se duas requisições passarem pela checagem otimista ao mesmo
// tempo, quem barra é a exclusion constraint do Postgres. Aqui só traduzimos o erro.
function traduzirErroDeConflito(err: unknown): never {
  const mensagem = err instanceof Error ? err.message : String(err);
  if (mensagem.includes("sem_conflito_horario")) {
    throw new AppError(
      "Esse horário acabou de ser preenchido por outro cliente. Escolha outro horário.",
      409
    );
  }
  throw err;
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
      duracaoMin: servico.duracaoMin,
      data: input.data,
      horaInicio: input.horaInicio,
    });

    try {
      return await agendamentosRepository.create({
        clienteId: usuarioLogado.sub,
        barbeiroId: input.barbeiroId,
        servicoId: input.servicoId,
        data: horaInicio,
        horaInicio,
        horaFim,
      });
    } catch (err) {
      traduzirErroDeConflito(err);
    }
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
      duracaoMin: agendamento.servico.duracaoMin,
      data: input.data,
      horaInicio: input.horaInicio,
      ignorarAgendamentoId: id, // não conflitar com o próprio agendamento
    });

    try {
      const novo = await agendamentosRepository.reagendar(id, {
        clienteId: agendamento.clienteId,
        barbeiroId: agendamento.barbeiroId,
        servicoId: agendamento.servicoId,
        data: horaInicio,
        horaInicio,
        horaFim,
      });
      // TODO (Fila de espera): o horário antigo acabou de ser liberado,
      // é aqui que vamos avisar o primeiro cliente da fila daquele horário.
      return novo;
    } catch (err) {
      traduzirErroDeConflito(err);
    }
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
    // TODO (Fila de espera): idem ao reagendar, o horário liberado aqui
    // dispara a notificação para o próximo da fila.
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
