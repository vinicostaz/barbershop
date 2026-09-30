import type { AuthPayload } from "../../middlewares/authMiddleware.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { disponibilidadesRepository } from "./disponibilidades.repository.js";

interface DisponibilidadeInput {
  diaSemana: number;
  horaInicio: string; // "09:00"
  horaFim: string; // "18:00"
}

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function validar(input: Partial<DisponibilidadeInput>) {
  if (input.diaSemana !== undefined && (input.diaSemana < 0 || input.diaSemana > 6)) {
    throw new AppError("diaSemana deve ser um número entre 0 (domingo) e 6 (sábado).");
  }
  if (input.horaInicio !== undefined && !HORA_REGEX.test(input.horaInicio)) {
    throw new AppError("horaInicio deve estar no formato HH:mm.");
  }
  if (input.horaFim !== undefined && !HORA_REGEX.test(input.horaFim)) {
    throw new AppError("horaFim deve estar no formato HH:mm.");
  }
  if (input.horaInicio && input.horaFim && input.horaInicio >= input.horaFim) {
    throw new AppError("horaInicio deve ser antes de horaFim.");
  }
}

// Garante que um BARBEIRO só mexe na própria agenda; ADMINISTRADOR pode mexer em qualquer uma.
function garantirPermissao(usuarioLogado: AuthPayload, barbeiroId: string) {
  const ehDonoDaAgenda = usuarioLogado.role === "BARBEIRO" && usuarioLogado.sub === barbeiroId;
  const ehAdministrador = usuarioLogado.role === "ADMINISTRADOR";

  if (!ehDonoDaAgenda && !ehAdministrador) {
    throw new AppError("Você só pode gerenciar a própria disponibilidade.", 403);
  }
}

export const disponibilidadesService = {
  listarPorBarbeiro(barbeiroId: string) {
    return disponibilidadesRepository.findByBarbeiro(barbeiroId);
  },

  async criar(usuarioLogado: AuthPayload, barbeiroId: string, input: DisponibilidadeInput) {
    garantirPermissao(usuarioLogado, barbeiroId);
    validar(input);
    return disponibilidadesRepository.create({ barbeiroId, ...input });
  },

  async atualizar(
    usuarioLogado: AuthPayload,
    id: string,
    input: Partial<DisponibilidadeInput>
  ) {
    const disponibilidade = await disponibilidadesRepository.findById(id);
    if (!disponibilidade) {
      throw new AppError("Disponibilidade não encontrada.", 404);
    }
    garantirPermissao(usuarioLogado, disponibilidade.barbeiroId);
    validar(input);
    return disponibilidadesRepository.update(id, input);
  },

  async remover(usuarioLogado: AuthPayload, id: string) {
    const disponibilidade = await disponibilidadesRepository.findById(id);
    if (!disponibilidade) {
      throw new AppError("Disponibilidade não encontrada.", 404);
    }
    garantirPermissao(usuarioLogado, disponibilidade.barbeiroId);
    return disponibilidadesRepository.delete(id);
  },
};
