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
import { agoraComoHoraDeParede } from "./agendamentos.tempo.js";

// Programa de fidelidade: cada atendimento concluído vale 1 ponto para o cliente
export const PONTOS_POR_ATENDIMENTO = 1;

// Texto usado nas notificações: "Corte com João em 20/10 às 14:00".
// As datas são hora de relógio salva como UTC, então basta ler os campos UTC.
export function descreverAgendamento(agendamento: {
  horaInicio: Date;
  servico: { nome: string };
  barbeiro: { nome: string };
}) {
  const iso = agendamento.horaInicio.toISOString();
  const data = `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const hora = iso.slice(11, 16);
  return `${agendamento.servico.nome} com ${agendamento.barbeiro.nome} em ${data} às ${hora}`;
}

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

  const conflitoDoCliente = await agendamentosRepository.findConflitanteCliente(
    params.clienteId,
    horaInicio,
    horaFim,
    params.ignorarAgendamentoId
  );
  if (conflitoDoCliente) {
    throw new AppError(
      "Você já possui outro agendamento que se sobrepõe a esse horário.",
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
    if (typeof input.barbeiroId !== "string" || !input.barbeiroId) {
      throw new AppError("barbeiroId é obrigatório.");
    }
    if (typeof input.servicoId !== "string" || !input.servicoId) {
      throw new AppError("servicoId é obrigatório.");
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

    // se quem cancelou não foi o próprio cliente (barbeiro ou administrador), ele é avisado
    const canceladoPeloCliente = agendamento.clienteId === usuarioLogado.sub;
    const cancelado = await agendamentosRepository.cancelar(
      id,
      canceladoPeloCliente
        ? undefined
        : {
            clienteId: agendamento.clienteId,
            mensagem: `Seu agendamento de ${descreverAgendamento(agendamento)} foi cancelado pela barbearia.`,
          }
    );
    if (!cancelado) {
      // outra requisição mudou o status entre a leitura e o cancelamento
      throw new AppError("Este agendamento não pode mais ser cancelado.", 409);
    }

    // o horário ficou livre: avisa o próximo da fila
    await liberarHorario(agendamento.barbeiroId, agendamento.horaInicio, agendamento.horaFim);
    return cancelado;
  },

  // Concluir atendimento: o barbeiro do agendamento (ou um administrador) marca
  // como realizado, e o cliente ganha pontos de fidelidade.
  async concluir(usuarioLogado: AuthPayload, id: string) {
    const agendamento = await agendamentosRepository.findById(id);
    if (!agendamento) {
      throw new AppError("Agendamento não encontrado.", 404);
    }

    const ehBarbeiroDoAtendimento =
      usuarioLogado.role === "BARBEIRO" && agendamento.barbeiroId === usuarioLogado.sub;
    const ehAdministrador = usuarioLogado.role === "ADMINISTRADOR";
    if (!ehBarbeiroDoAtendimento && !ehAdministrador) {
      throw new AppError("Apenas o barbeiro do atendimento ou um administrador pode concluí-lo.", 403);
    }

    if (agendamento.status !== "CONFIRMADO") {
      throw new AppError("Apenas agendamentos confirmados podem ser concluídos.", 400);
    }

    // não dá para concluir um atendimento que ainda nem começou
    if (agendamento.horaInicio.getTime() > agoraComoHoraDeParede().getTime()) {
      throw new AppError("Só é possível concluir um atendimento depois do horário de início.", 400);
    }

    const concluido = await agendamentosRepository.concluir(
      id,
      agendamento.clienteId,
      PONTOS_POR_ATENDIMENTO,
      `Seu atendimento de ${descreverAgendamento(agendamento)} foi concluído e você ganhou ` +
        `${PONTOS_POR_ATENDIMENTO} ponto${PONTOS_POR_ATENDIMENTO === 1 ? "" : "s"} de fidelidade. ` +
        "Conte para a gente como foi: avalie o atendimento!"
    );
    if (!concluido) {
      // outra requisição mudou o status entre a leitura e a conclusão
      throw new AppError("Este agendamento já foi concluído ou cancelado.", 409);
    }
    return concluido;
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
