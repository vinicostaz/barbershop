import type { AuthPayload } from "../../middlewares/authMiddleware.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { db } from "../../prisma/client.js";
import { agendamentosRepository } from "../agendamentos/agendamentos.repository.js";
import { agoraComoHoraDeParede } from "../agendamentos/agendamentos.tempo.js";
import {
  adicionarMinutos,
  combinarDataHora,
  diaDaSemana,
} from "../agendamentos/agendamentos.utils.js";
import { validarData } from "../agendamentos/agendamentos.horario.js";
import { bloqueiosRepository } from "../bloqueios/bloqueios.repository.js";
import { filaDeEsperaRepository } from "../filaDeEspera/filaDeEspera.repository.js";
import { servicosRepository } from "../servicos/servicos.repository.js";
import { disponibilidadesRepository } from "./disponibilidades.repository.js";

export interface DisponibilidadeInput {
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
}

export interface IntervaloIndisponivel {
  horaInicio: Date;
  horaFim: Date;
}

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const PASSO_HORARIO_MINUTOS = 15;
const DIAS_MAXIMOS_DE_BUSCA = 90;

function horaParaMinutos(hora: string) {
  const [horas, minutos] = hora.split(":").map(Number);
  return horas * 60 + minutos;
}

function minutosParaHora(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function intervalosSeSobrepoem(
  inicioA: Date,
  fimA: Date,
  inicioB: Date,
  fimB: Date
) {
  return inicioA < fimB && inicioB < fimA;
}

export function gerarHorariosLivres(
  data: string,
  duracaoMin: number,
  blocos: DisponibilidadeInput[],
  indisponiveis: IntervaloIndisponivel[],
  agora = agoraComoHoraDeParede()
) {
  validarData(data);
  if (!Number.isInteger(duracaoMin) || duracaoMin <= 0) {
    throw new AppError("A duração do serviço deve ser maior que zero.");
  }

  const horarios = new Set<string>();

  for (const bloco of blocos) {
    const inicioBloco = horaParaMinutos(bloco.horaInicio);
    const fimBloco = horaParaMinutos(bloco.horaFim);

    for (
      let minutos = inicioBloco;
      minutos + duracaoMin <= fimBloco;
      minutos += PASSO_HORARIO_MINUTOS
    ) {
      const hora = minutosParaHora(minutos);
      const inicio = combinarDataHora(data, hora);
      const fim = adicionarMinutos(inicio, duracaoMin);

      if (inicio.getTime() < agora.getTime()) continue;
      if (
        indisponiveis.some((periodo) =>
          intervalosSeSobrepoem(inicio, fim, periodo.horaInicio, periodo.horaFim)
        )
      ) {
        continue;
      }

      horarios.add(hora);
    }
  }

  return [...horarios].sort();
}

function validar(input: Partial<DisponibilidadeInput>, completa = false) {
  if (completa) {
    if (!Number.isInteger(input.diaSemana)) {
      throw new AppError("diaSemana é obrigatório e deve ser um número inteiro.");
    }
    if (typeof input.horaInicio !== "string") {
      throw new AppError("horaInicio é obrigatório.");
    }
    if (typeof input.horaFim !== "string") {
      throw new AppError("horaFim é obrigatório.");
    }
  }
  if (
    input.diaSemana !== undefined &&
    (!Number.isInteger(input.diaSemana) || input.diaSemana < 0 || input.diaSemana > 6)
  ) {
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

function garantirPermissao(usuarioLogado: AuthPayload, barbeiroId: string) {
  const ehDonoDaAgenda = usuarioLogado.role === "BARBEIRO" && usuarioLogado.sub === barbeiroId;
  const ehAdministrador = usuarioLogado.role === "ADMINISTRADOR";

  if (!ehDonoDaAgenda && !ehAdministrador) {
    throw new AppError("Você só pode gerenciar a própria disponibilidade.", 403);
  }
}

async function buscarBarbeiro(barbeiroId: string, exigirAtivo: boolean) {
  const barbeiro = await db.usuario.findFirst({
    where: {
      id: barbeiroId,
      role: "BARBEIRO",
      ...(exigirAtivo ? { ativo: true } : {}),
    },
    select: { id: true },
  });
  if (!barbeiro) {
    throw new AppError("Barbeiro não encontrado ou inativo.", 404);
  }
  return barbeiro;
}

async function buscarIndisponibilidades(barbeiroId: string, inicio: Date, fim: Date) {
  const [agendamentos, bloqueios, prioridades] = await Promise.all([
    agendamentosRepository.findConfirmadosNoPeriodo(barbeiroId, inicio, fim),
    bloqueiosRepository.findNoPeriodo(barbeiroId, inicio, fim),
    filaDeEsperaRepository.findPrioridadesAtivasNoPeriodo(barbeiroId, inicio, fim),
  ]);

  return [
    ...agendamentos,
    ...bloqueios.map((bloqueio) => ({
      horaInicio: bloqueio.inicio,
      horaFim: bloqueio.fim,
    })),
    ...prioridades,
  ];
}

export const disponibilidadesService = {
  async listarDatasDisponiveis(barbeiroId: string, servicoId: string, limite: number) {
    if (!servicoId) throw new AppError("servicoId é obrigatório.");
    if (!Number.isInteger(limite) || limite < 1 || limite > 31) {
      throw new AppError("limite deve ser um número inteiro entre 1 e 31.");
    }

    await buscarBarbeiro(barbeiroId, true);
    const servico = await servicosRepository.findById(servicoId);
    if (!servico) throw new AppError("Serviço não encontrado.", 404);

    const disponibilidades = await disponibilidadesRepository.findByBarbeiro(barbeiroId);
    if (disponibilidades.length === 0) return [];

    const agora = agoraComoHoraDeParede();
    const inicioBusca = combinarDataHora(agora.toISOString().slice(0, 10), "00:00");
    const fimBusca = adicionarMinutos(inicioBusca, DIAS_MAXIMOS_DE_BUSCA * 24 * 60);
    const indisponiveis = await buscarIndisponibilidades(barbeiroId, inicioBusca, fimBusca);
    const datas: string[] = [];

    for (let deslocamento = 0; deslocamento < DIAS_MAXIMOS_DE_BUSCA; deslocamento += 1) {
      const inicioDia = adicionarMinutos(inicioBusca, deslocamento * 24 * 60);
      const data = inicioDia.toISOString().slice(0, 10);
      const blocos = disponibilidades.filter((bloco) => bloco.diaSemana === diaDaSemana(data));
      if (blocos.length === 0) continue;

      const horarios = gerarHorariosLivres(data, servico.duracaoMin, blocos, indisponiveis, agora);
      if (horarios.length > 0) datas.push(data);
      if (datas.length === limite) break;
    }

    return datas;
  },

  async listarHorariosLivres(barbeiroId: string, data: string, servicoId: string) {
    validarData(data);
    if (!servicoId) throw new AppError("servicoId é obrigatório.");

    await buscarBarbeiro(barbeiroId, true);
    const servico = await servicosRepository.findById(servicoId);
    if (!servico) throw new AppError("Serviço não encontrado.", 404);

    const disponibilidades = await disponibilidadesRepository.findByBarbeiro(barbeiroId);
    const blocos = disponibilidades.filter((bloco) => bloco.diaSemana === diaDaSemana(data));
    if (blocos.length === 0) return [];

    const inicioDia = combinarDataHora(data, "00:00");
    const fimDia = adicionarMinutos(inicioDia, 24 * 60);
    const indisponiveis = await buscarIndisponibilidades(barbeiroId, inicioDia, fimDia);
    return gerarHorariosLivres(data, servico.duracaoMin, blocos, indisponiveis);
  },

  async listarPorBarbeiro(barbeiroId: string) {
    await buscarBarbeiro(barbeiroId, true);
    return disponibilidadesRepository.findByBarbeiro(barbeiroId);
  },

  async criar(usuarioLogado: AuthPayload, barbeiroId: string, input: DisponibilidadeInput) {
    garantirPermissao(usuarioLogado, barbeiroId);
    validar(input, true);
    await buscarBarbeiro(barbeiroId, false);
    const sobreposta = await disponibilidadesRepository.findSobreposta(
      barbeiroId,
      input.diaSemana,
      input.horaInicio,
      input.horaFim
    );
    if (sobreposta) {
      throw new AppError("Já existe uma disponibilidade que se sobrepõe a esse período.", 409);
    }
    return disponibilidadesRepository.create({ barbeiroId, ...input });
  },

  async atualizar(
    usuarioLogado: AuthPayload,
    id: string,
    input: Partial<DisponibilidadeInput>
  ) {
    const atual = await disponibilidadesRepository.findById(id);
    if (!atual) throw new AppError("Disponibilidade não encontrada.", 404);
    garantirPermissao(usuarioLogado, atual.barbeiroId);

    const dados: DisponibilidadeInput = {
      diaSemana: input.diaSemana ?? atual.diaSemana,
      horaInicio: input.horaInicio ?? atual.horaInicio,
      horaFim: input.horaFim ?? atual.horaFim,
    };
    validar(dados, true);

    const sobreposta = await disponibilidadesRepository.findSobreposta(
      atual.barbeiroId,
      dados.diaSemana,
      dados.horaInicio,
      dados.horaFim,
      id
    );
    if (sobreposta) {
      throw new AppError("Já existe uma disponibilidade que se sobrepõe a esse período.", 409);
    }
    return disponibilidadesRepository.update(id, dados);
  },

  async remover(usuarioLogado: AuthPayload, id: string) {
    const disponibilidade = await disponibilidadesRepository.findById(id);
    if (!disponibilidade) throw new AppError("Disponibilidade não encontrada.", 404);
    garantirPermissao(usuarioLogado, disponibilidade.barbeiroId);
    return disponibilidadesRepository.delete(id);
  },
};
