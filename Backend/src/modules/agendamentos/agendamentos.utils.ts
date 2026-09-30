// Combina uma data ("2026-10-05") e uma hora ("09:00") em um único Date (UTC),
// pra evitar problemas de fuso horário entre o que o front envia e o banco.
export function combinarDataHora(data: string, hora: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, h, m));
}

export function adicionarMinutos(data: Date, minutos: number): Date {
  return new Date(data.getTime() + minutos * 60_000);
}

// 0 = domingo ... 6 = sábado, mesmo padrão usado em Disponibilidade.diaSemana
export function diaDaSemana(data: string): number {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

export function formatarHora(data: Date): string {
  return data.toISOString().slice(11, 16); // "HH:mm"
}
