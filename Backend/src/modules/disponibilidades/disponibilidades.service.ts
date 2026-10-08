import type { AuthPayload } from "../../middlewares/authMiddleware.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { agendamentosRepository } from "../agendamentos/agendamentos.repository.js";
import {
  adicionarMinutos,
  combinarDataHora,
  diaDaSemana,
} from "../agendamentos/agendamentos.utils.js";
import { servicosRepository } from "../servicos/servicos.repository.js";
import { disponibilidadesRepository } from "./disponibilidades.repository.js";

interface DisponibilidadeInput {
  diaSemana: number;
  horaInicio: string; // "09:00"
  horaFim: string; // "18:00"
}

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function horaParaMinutos(hora: string) {
  const [horas, minutos] = hora.split(":").map(Number);
  return horas * 60 + minutos;
}

interface BlocoDisponibilidade {
  diaSemana: number;
  horaFim: string;
  horaInicio: string;
}

interface PeriodoAgendado {
  horaFim: Date;
  horaInicio: Date;
}

function minutosParaHora(total: number) {
  const horas = String(Math.floor(total / 60)).padStart(2, "0");
  const minutos = String(total % 60).padStart(2, "0");
  return `${horas}:${minutos}`;
}

function validarData(data: string) {
  if (!DATA_REGEX.test(data)) {
    throw new AppError("data deve estar no formato AAAA-MM-DD.");
  }

  const dataUtc = new Date(`${data}T00:00:00.000Z`);
  if (Number.isNaN(dataUtc.getTime()) || dataUtc.toISOString().slice(0, 10) !== data) {
    throw new AppError("Data inválida.");
  }
}

function gerarHorariosLivres(
  data: string,
  duracaoMin: number,
  blocos: BlocoDisponibilidade[],
  agendamentos: PeriodoAgendado[]
) {
  const inicioDoDia = combinarDataHora(data, "00:00");
  const horarios = new Set<string>();
  const periodosOcupados = agendamentos
    .map((agendamento) => ({
      fim: Math.ceil(
        (agendamento.horaFim.getTime() - inicioDoDia.getTime()) / 60_000
      ),
      inicio: Math.floor(
        (agendamento.horaInicio.getTime() - inicioDoDia.getTime()) / 60_000
      ),
    }))
    .sort((a, b) => a.inicio - b.inicio);

  function adicionarIntervaloLivre(inicio: number, fim: number) {
    for (
      let horario = inicio;
      horario + duracaoMin <= fim;
      horario += duracaoMin
    ) {
      horarios.add(minutosParaHora(horario));
    }
  }

  for (const bloco of blocos) {
    const inicioBloco = horaParaMinutos(bloco.horaInicio);
    const fimBloco = horaParaMinutos(bloco.horaFim);
    let inicioLivre = inicioBloco;

    for (const ocupado of periodosOcupados) {
      if (ocupado.fim <= inicioLivre || ocupado.inicio >= fimBloco) continue;

      const inicioOcupado = Math.max(inicioBloco, ocupado.inicio);
      const fimOcupado = Math.min(fimBloco, ocupado.fim);

      if (inicioOcupado > inicioLivre) {
        adicionarIntervaloLivre(inicioLivre, inicioOcupado);
      }

      inicioLivre = Math.max(inicioLivre, fimOcupado);
      if (inicioLivre >= fimBloco) break;
    }

    if (inicioLivre < fimBloco) {
      adicionarIntervaloLivre(inicioLivre, fimBloco);
    }
  }

  return [...horarios].sort();
}

function dataLocalParaId(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

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
  async listarDatasDisponiveis(
    barbeiroId: string,
    servicoId: string,
    limite: number
  ) {
    if (!servicoId) {
      throw new AppError("servicoId é obrigatório.");
    }
    if (!Number.isInteger(limite) || limite < 1 || limite > 10) {
      throw new AppError("limite deve ser um número entre 1 e 10.");
    }

    const servico = await servicosRepository.findById(servicoId);
    if (!servico) {
      throw new AppError("Serviço não encontrado.", 404);
    }

    const disponibilidades = await disponibilidadesRepository.findByBarbeiro(
      barbeiroId
    );
    if (disponibilidades.length === 0) return [];

    const hoje = dataLocalParaId(new Date());
    const inicioBusca = adicionarMinutos(
      combinarDataHora(hoje, "00:00"),
      24 * 60
    );
    const fimBusca = adicionarMinutos(inicioBusca, 90 * 24 * 60);
    const agendamentos = await agendamentosRepository.findConfirmadosNoPeriodo(
      barbeiroId,
      inicioBusca,
      fimBusca
    );
    const datas: string[] = [];

    for (let deslocamento = 0; deslocamento < 90; deslocamento += 1) {
      const inicioDoDia = adicionarMinutos(
        inicioBusca,
        deslocamento * 24 * 60
      );
      const fimDoDia = adicionarMinutos(inicioDoDia, 24 * 60);
      const data = inicioDoDia.toISOString().slice(0, 10);
      const blocosDoDia = disponibilidades.filter(
        (disponibilidade) => disponibilidade.diaSemana === diaDaSemana(data)
      );

      if (blocosDoDia.length === 0) continue;

      const agendamentosDoDia = agendamentos.filter(
        (agendamento) =>
          agendamento.horaInicio < fimDoDia &&
          agendamento.horaFim > inicioDoDia
      );
      const horarios = gerarHorariosLivres(
        data,
        servico.duracaoMin,
        blocosDoDia,
        agendamentosDoDia
      );

      if (horarios.length > 0) datas.push(data);
      if (datas.length === limite) break;
    }

    return datas;
  },

  async listarHorariosLivres(
    barbeiroId: string,
    data: string,
    servicoId: string
  ) {
    validarData(data);
    if (!servicoId) {
      throw new AppError("servicoId é obrigatório.");
    }

    const servico = await servicosRepository.findById(servicoId);
    if (!servico) {
      throw new AppError("Serviço não encontrado.", 404);
    }

    const disponibilidades = await disponibilidadesRepository.findByBarbeiro(
      barbeiroId
    );
    const blocosDoDia = disponibilidades.filter(
      (disponibilidade) => disponibilidade.diaSemana === diaDaSemana(data)
    );

    if (blocosDoDia.length === 0) return [];

    const inicioDoDia = combinarDataHora(data, "00:00");
    const fimDoDia = adicionarMinutos(inicioDoDia, 24 * 60);
    const agendamentos = await agendamentosRepository.findConfirmadosNoPeriodo(
      barbeiroId,
      inicioDoDia,
      fimDoDia
    );
    return gerarHorariosLivres(
      data,
      servico.duracaoMin,
      blocosDoDia,
      agendamentos
    );
  },

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
