import type { AuthPayload } from "../../middlewares/authMiddleware.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { db } from "../../prisma/client.js";
import { disponibilidadesRepository } from "../disponibilidades/disponibilidades.repository.js";
import { servicosRepository } from "../servicos/servicos.repository.js";
import { agendamentosRepository } from "./agendamentos.repository.js";
import { adicionarMinutos, combinarDataHora, diaDaSemana, formatarHora } from "./agendamentos.utils.js";

interface CriarAgendamentoInput {
  barbeiroId: string;
  servicoId: string;
  data: string; // "2026-10-05"
  horaInicio: string; // "09:00"
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

    const horaInicio = combinarDataHora(input.data, input.horaInicio);
    const horaFim = adicionarMinutos(horaInicio, servico.duracaoMin);

    // 1) o horário pedido precisa caber dentro de algum bloco de disponibilidade do barbeiro
    const disponibilidadesDoDia = await disponibilidadesRepository.findByBarbeiro(
      input.barbeiroId
    );
    const diaSemana = diaDaSemana(input.data);
    const cabeNaDisponibilidade = disponibilidadesDoDia.some(
      (d) =>
        d.diaSemana === diaSemana &&
        formatarHora(horaInicio) >= d.horaInicio &&
        formatarHora(horaFim) <= d.horaFim
    );
    if (!cabeNaDisponibilidade) {
      throw new AppError(
        "O horário escolhido está fora da disponibilidade do barbeiro.",
        400
      );
    }

    // 2) checagem "otimista" de conflito (rápida, evita ir ao banco tentar e falhar)
    const conflito = await agendamentosRepository.findConflitante(
      input.barbeiroId,
      horaInicio,
      horaFim
    );
    if (conflito) {
      throw new AppError(
        "Esse horário já está ocupado para este barbeiro. Escolha outro horário ou entre na fila de espera.",
        409
      );
    }

    // 3) checagem "definitiva": mesmo com o passo 2, duas requisições simultâneas
    // podem passar pela checagem otimista ao mesmo tempo. Quem garante que isso não
    // vira um agendamento duplicado é a exclusion constraint do Postgres.
    try {
      return await agendamentosRepository.create({
        clienteId: usuarioLogado.sub,
        barbeiroId: input.barbeiroId,
        servicoId: input.servicoId,
        data: horaInicio,
        horaInicio,
        horaFim,
      });
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : String(err);
      if (mensagem.includes("sem_conflito_horario")) {
        throw new AppError(
          "Esse horário acabou de ser preenchido por outro cliente. Escolha outro horário.",
          409
        );
      }
      throw err;
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

    return agendamentosRepository.updateStatus(id, "CANCELADO");
    // Observação: liberar o horário para a fila de espera (UC09/UC10) entra
    // como próximo módulo — este cancelamento por si só já respeita a regra
    // "sem realização automática do agendamento" descrita na arquitetura.
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
