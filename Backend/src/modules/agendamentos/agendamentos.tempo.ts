// O sistema guarda data e hora como "hora de relógio" tratada como UTC
// (10:00 no relógio da barbearia fica salvo como 10:00Z, sem conversão de fuso).
// Por isso, para saber se um horário já passou, "agora" também precisa estar
// nesse mesmo formato: a hora de relógio do fuso da barbearia, escrita como UTC.
//
// O fuso padrão é America/Fortaleza (UTC-3, sem horário de verão).
// Para mudar, defina FUSO_HORARIO no .env (ex.: America/Sao_Paulo).
const FUSO = process.env.FUSO_HORARIO ?? "America/Fortaleza";

const formatador = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function agoraComoHoraDeParede(): Date {
  const partes = formatador.formatToParts(new Date());
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  return new Date(
    Date.UTC(valor("year"), valor("month") - 1, valor("day"), valor("hour"), valor("minute"), valor("second"))
  );
}
