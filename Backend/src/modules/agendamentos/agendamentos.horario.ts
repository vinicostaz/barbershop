import { AppError } from "../../middlewares/errorHandler.js";
import { bloqueiosRepository } from "../bloqueios/bloqueios.repository.js";
import { disponibilidadesRepository } from "../disponibilidades/disponibilidades.repository.js";
import { agoraComoHoraDeParede } from "./agendamentos.tempo.js";
import { adicionarMinutos, combinarDataHora, formatarHora } from "./agendamentos.utils.js";

// Funções de horário compartilhadas entre Agendamento e Fila de Espera.

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

// Valida o formato, recusa horários que já passaram e calcula o intervalo
// [horaInicio, horaFim) do atendimento.
export function calcularHorario(data: string, hora: string, duracaoMin: number) {
  if (!DATA_REGEX.test(data ?? "")) {
    throw new AppError("data deve estar no formato AAAA-MM-DD.");
  }
  if (!HORA_REGEX.test(hora ?? "")) {
    throw new AppError("horaInicio deve estar no formato HH:mm.");
  }
  const horaInicio = combinarDataHora(data, hora);
  if (horaInicio.getTime() < agoraComoHoraDeParede().getTime()) {
    throw new AppError("Não é possível agendar em um horário que já passou.");
  }
  const horaFim = adicionarMinutos(horaInicio, duracaoMin);
  return { horaInicio, horaFim };
}

// O intervalo precisa caber dentro de algum bloco de disponibilidade do barbeiro
// e não pode cair em um período que ele bloqueou (folga, férias etc.).
export async function validarDisponibilidade(barbeiroId: string, horaInicio: Date, horaFim: Date) {
  const disponibilidades = await disponibilidadesRepository.findByBarbeiro(barbeiroId);
  const diaSemana = horaInicio.getUTCDay(); // 0 = domingo ... 6 = sábado
  const cabe = disponibilidades.some(
    (d) =>
      d.diaSemana === diaSemana &&
      formatarHora(horaInicio) >= d.horaInicio &&
      formatarHora(horaFim) <= d.horaFim
  );
  if (!cabe) {
    throw new AppError("O horário escolhido está fora da disponibilidade do barbeiro.", 400);
  }

  const bloqueio = await bloqueiosRepository.findSobreposto(barbeiroId, horaInicio, horaFim);
  if (bloqueio) {
    throw new AppError("O barbeiro não atende neste período (agenda bloqueada).", 400);
  }
}

// Checagem "definitiva" de conflito: se duas requisições passarem pela checagem otimista
// ao mesmo tempo, quem barra é a exclusion constraint do Postgres. Aqui só traduzimos o erro.
export function traduzirErroDeConflito(err: unknown): never {
  const mensagem = err instanceof Error ? err.message : String(err);
  if (mensagem.includes("sem_conflito_horario")) {
    throw new AppError(
      "Esse horário acabou de ser preenchido por outro cliente. Escolha outro horário.",
      409
    );
  }
  throw err;
}
