import { AppError } from "../../middlewares/errorHandler.js";
import { bloqueiosRepository } from "../bloqueios/bloqueios.repository.js";
import { disponibilidadesRepository } from "../disponibilidades/disponibilidades.repository.js";
import { agoraComoHoraDeParede } from "./agendamentos.tempo.js";
import { adicionarMinutos, combinarDataHora, formatarHora } from "./agendamentos.utils.js";

// Funções de horário compartilhadas entre Agendamento e Fila de Espera.

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validarData(data: string) {
  if (typeof data !== "string" || !DATA_REGEX.test(data)) {
    throw new AppError("data deve estar no formato AAAA-MM-DD.");
  }

  const [ano, mes, dia] = data.split("-").map(Number);
  const dataUtc = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    dataUtc.getUTCFullYear() !== ano ||
    dataUtc.getUTCMonth() !== mes - 1 ||
    dataUtc.getUTCDate() !== dia
  ) {
    throw new AppError("Data inválida.");
  }
}

// Valida o formato, recusa horários que já passaram e calcula o intervalo
// [horaInicio, horaFim) do atendimento.
export function calcularHorario(data: string, hora: string, duracaoMin: number) {
  validarData(data);
  if (!HORA_REGEX.test(hora ?? "")) {
    throw new AppError("horaInicio deve estar no formato HH:mm.");
  }
  if (!Number.isInteger(duracaoMin) || duracaoMin <= 0) {
    throw new AppError("A duração do serviço deve ser maior que zero.");
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

// O Prisma embrulha o erro do Postgres de jeitos diferentes conforme o driver e a versão:
// às vezes o nome da constraint vem na mensagem, às vezes só o código 23P01, às vezes
// dentro de `meta` ou `cause`. Por isso olhamos todos esses lugares, em vez de depender de
// um único texto.
export function ehConflitoDeHorario(err: unknown): boolean {
  const e = err as { message?: unknown; code?: unknown; meta?: unknown; cause?: unknown } | null;
  const causa = e?.cause as
    | { message?: unknown; originalCode?: unknown; originalMessage?: unknown }
    | undefined;

  const partes = [
    String(e?.message ?? ""),
    String(e?.code ?? ""),
    String(causa?.message ?? ""),
    String(causa?.originalCode ?? ""),
    String(causa?.originalMessage ?? ""),
  ];
  try {
    partes.push(JSON.stringify(e?.meta ?? {}, (_k, v) => (typeof v === "bigint" ? String(v) : v)));
  } catch {
    // meta com referência circular: ignora, os outros campos já cobrem
  }
  return /sem_conflito_horario|23P01|exclusion/i.test(partes.join(" | "));
}

// Checagem "definitiva" de conflito: se duas requisições passarem pela checagem otimista
// ao mesmo tempo, quem barra é a exclusion constraint do Postgres. Aqui só traduzimos o erro.
export function traduzirErroDeConflito(err: unknown): never {
  if (ehConflitoDeHorario(err)) {
    throw new AppError(
      "Esse horário acabou de ser preenchido por outro cliente. Escolha outro horário.",
      409
    );
  }
  throw err;
}
