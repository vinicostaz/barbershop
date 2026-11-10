import type { AuthPayload } from "../../middlewares/authMiddleware.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { agoraComoHoraDeParede } from "../agendamentos/agendamentos.tempo.js";
import { dashboardRepository } from "./dashboard.repository.js";

type Status = "CONFIRMADO" | "CONCLUIDO" | "CANCELADO" | "REAGENDADO";

type AgendamentoDashboard = Awaited<
  ReturnType<typeof dashboardRepository.buscarAgendamentosDoPeriodo>
>[number];

const statusOperacionais = new Set<Status>(["CONFIRMADO", "CONCLUIDO"]);

export function periodoDoMes(mes: unknown) {
  if (typeof mes !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    throw new AppError("Informe o mês no formato AAAA-MM.");
  }

  const [ano, numeroMes] = mes.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, numeroMes - 1, 1));
  const fim = new Date(Date.UTC(ano, numeroMes, 1));

  return { fim, inicio, mes };
}

function dataKey(data: Date) {
  return data.toISOString().slice(0, 10);
}

function horaKey(data: Date) {
  return `${String(data.getUTCHours()).padStart(2, "0")}:00`;
}

function percentual(parte: number, total: number) {
  return total === 0 ? 0 : Number(((parte / total) * 100).toFixed(1));
}

function media(valores: number[]) {
  return valores.length === 0
    ? null
    : Number((valores.reduce((total, valor) => total + valor, 0) / valores.length).toFixed(1));
}

function diasDoPeriodo(inicio: Date, fim: Date) {
  const dias: string[] = [];
  for (const cursor = new Date(inicio); cursor < fim; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dias.push(dataKey(cursor));
  }
  return dias;
}

export function construirMetricasDashboard(
  agendamentos: AgendamentoDashboard[],
  periodo: ReturnType<typeof periodoDoMes>,
  complementos: {
    clientesNovos: number;
    profissionaisAtivos: Array<{ id: string; nome: string }>;
    servicosCadastrados: number;
  }
) {
  const porStatus: Record<Status, number> = {
    CANCELADO: 0,
    CONCLUIDO: 0,
    CONFIRMADO: 0,
    REAGENDADO: 0,
  };

  const operacionais = agendamentos.filter((item) => statusOperacionais.has(item.status));
  const concluidos = agendamentos.filter((item) => item.status === "CONCLUIDO");
  const faturamento = concluidos.reduce((total, item) => total + Number(item.servico.preco), 0);

  for (const agendamento of agendamentos) porStatus[agendamento.status] += 1;

  const clientes = new Map<string, number>();
  for (const agendamento of operacionais) {
    clientes.set(agendamento.clienteId, (clientes.get(agendamento.clienteId) ?? 0) + 1);
  }
  const clientesRecorrentes = [...clientes.values()].filter((quantidade) => quantidade >= 2).length;

  const seriePorDia = new Map(
    diasDoPeriodo(periodo.inicio, periodo.fim).map((data) => [
      data,
      { agendamentos: 0, data, faturamento: 0 },
    ])
  );
  for (const agendamento of operacionais) {
    const dia = seriePorDia.get(dataKey(agendamento.horaInicio));
    if (!dia) continue;
    dia.agendamentos += 1;
    if (agendamento.status === "CONCLUIDO") dia.faturamento += Number(agendamento.servico.preco);
  }

  const servicos = new Map<
    string,
    { agendamentos: number; faturamento: number; id: string; nome: string }
  >();
  const profissionais = new Map<
    string,
    {
      agendamentos: number;
      avaliacoes: number[];
      cancelamentos: number;
      concluidos: number;
      faturamento: number;
      id: string;
      nome: string;
    }
  >();
  const horarios = new Map<string, number>();

  for (const profissional of complementos.profissionaisAtivos) {
    profissionais.set(profissional.id, {
      agendamentos: 0,
      avaliacoes: [],
      cancelamentos: 0,
      concluidos: 0,
      faturamento: 0,
      id: profissional.id,
      nome: profissional.nome,
    });
  }

  for (const agendamento of agendamentos) {
    const profissional = profissionais.get(agendamento.barbeiroId) ?? {
      agendamentos: 0,
      avaliacoes: [],
      cancelamentos: 0,
      concluidos: 0,
      faturamento: 0,
      id: agendamento.barbeiro.id,
      nome: agendamento.barbeiro.nome,
    };

    if (statusOperacionais.has(agendamento.status)) profissional.agendamentos += 1;
    if (agendamento.status === "CANCELADO") profissional.cancelamentos += 1;
    if (agendamento.status === "CONCLUIDO") {
      profissional.concluidos += 1;
      profissional.faturamento += Number(agendamento.servico.preco);
    }
    if (agendamento.avaliacao) profissional.avaliacoes.push(agendamento.avaliacao.nota);
    profissionais.set(agendamento.barbeiroId, profissional);

    if (!statusOperacionais.has(agendamento.status)) continue;

    const servico = servicos.get(agendamento.servicoId) ?? {
      agendamentos: 0,
      faturamento: 0,
      id: agendamento.servico.id,
      nome: agendamento.servico.nome,
    };
    servico.agendamentos += 1;
    if (agendamento.status === "CONCLUIDO") servico.faturamento += Number(agendamento.servico.preco);
    servicos.set(agendamento.servicoId, servico);

    const hora = horaKey(agendamento.horaInicio);
    horarios.set(hora, (horarios.get(hora) ?? 0) + 1);
  }

  const notas = agendamentos.flatMap((item) => (item.avaliacao ? [item.avaliacao.nota] : []));

  return {
    clientes: {
      novos: complementos.clientesNovos,
      recorrentes: clientesRecorrentes,
      taxaRecorrencia: percentual(clientesRecorrentes, clientes.size),
      unicos: clientes.size,
    },
    contexto: {
      profissionaisAtivos: complementos.profissionaisAtivos.length,
      servicosCadastrados: complementos.servicosCadastrados,
    },
    horariosPico: [...horarios.entries()]
      .map(([hora, agendamentos]) => ({ agendamentos, hora }))
      .sort((a, b) => b.agendamentos - a.agendamentos || a.hora.localeCompare(b.hora))
      .slice(0, 6),
    periodo: { fim: periodo.fim.toISOString(), inicio: periodo.inicio.toISOString(), mes: periodo.mes },
    profissionais: [...profissionais.values()]
      .map(({ avaliacoes, ...profissional }) => ({
        ...profissional,
        avaliacaoMedia: media(avaliacoes),
        totalAvaliacoes: avaliacoes.length,
      }))
      .sort((a, b) => b.faturamento - a.faturamento || b.agendamentos - a.agendamentos),
    resumo: {
      agendamentos: operacionais.length,
      avaliacaoMedia: media(notas),
      cancelamentos: porStatus.CANCELADO,
      concluidos: concluidos.length,
      faturamento: Number(faturamento.toFixed(2)),
      reagendamentos: porStatus.REAGENDADO,
      taxaCancelamento: percentual(porStatus.CANCELADO, agendamentos.length),
      taxaReagendamento: percentual(porStatus.REAGENDADO, agendamentos.length),
      ticketMedio: concluidos.length === 0 ? 0 : Number((faturamento / concluidos.length).toFixed(2)),
      totalAvaliacoes: notas.length,
    },
    serieDiaria: [...seriePorDia.values()].map((item) => ({
      ...item,
      faturamento: Number(item.faturamento.toFixed(2)),
    })),
    servicos: [...servicos.values()].sort(
      (a, b) => b.agendamentos - a.agendamentos || b.faturamento - a.faturamento
    ),
    status: porStatus,
  };
}

export const dashboardService = {
  async resumo(usuario: AuthPayload, mes: unknown) {
    if (usuario.role !== "ADMINISTRADOR") {
      throw new AppError("Apenas administradores podem acessar o dashboard.", 403);
    }

    const periodo = periodoDoMes(mes);
    const [agendamentos, proximos, clientesNovos, profissionaisAtivos, servicosCadastrados] =
      await Promise.all([
        dashboardRepository.buscarAgendamentosDoPeriodo(periodo.inicio, periodo.fim),
        dashboardRepository.buscarProximosAgendamentos(agoraComoHoraDeParede(), 5),
        dashboardRepository.contarClientesCriados(periodo.inicio, periodo.fim),
        dashboardRepository.buscarProfissionaisAtivos(),
        dashboardRepository.contarServicos(),
      ]);

    return {
      ...construirMetricasDashboard(agendamentos, periodo, {
        clientesNovos,
        profissionaisAtivos,
        servicosCadastrados,
      }),
      proximosAgendamentos: proximos.map((item) => ({
        barbeiro: item.barbeiro,
        cliente: item.cliente,
        horaFim: item.horaFim.toISOString(),
        horaInicio: item.horaInicio.toISOString(),
        id: item.id,
        servico: item.servico,
      })),
    };
  },
};
