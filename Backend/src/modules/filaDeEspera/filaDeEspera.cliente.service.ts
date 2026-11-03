import type { AuthPayload } from "../../middlewares/authMiddleware.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { agoraComoHoraDeParede } from "../agendamentos/agendamentos.tempo.js";
import { adicionarMinutos, combinarDataHora, diaDaSemana, formatarHora } from "../agendamentos/agendamentos.utils.js";
import { disponibilidadesRepository } from "../disponibilidades/disponibilidades.repository.js";
import { gerarHorariosLivres } from "../disponibilidades/disponibilidades.service.js";
import { filaClienteRepository } from "./filaDeEspera.cliente.repository.js";
import { filaDeEsperaRepository } from "./filaDeEspera.repository.js";
import { filaDeEsperaService } from "./filaDeEspera.service.js";

// Parte da fila de espera voltada ao CLIENTE: o que o front precisa para
//   - descobrir em quais horários ocupados vale a pena entrar na fila,
//   - mostrar a posição e se já dá para confirmar,
//   - permitir desistir.

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MINUTOS_NO_DIA = 24 * 60;

interface Faixa {
  inicio: Date;
  fim: Date;
}

const sobrepoe = (a: Faixa, b: Faixa) =>
  a.inicio.getTime() < b.fim.getTime() && b.inicio.getTime() < a.fim.getTime();

function dataExiste(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

// Uma falha ao avisar o próximo da fila não pode derrubar a resposta ao cliente.
async function avisarProximo(barbeiroId: string, horaInicio: Date, horaFim: Date) {
  try {
    await filaDeEsperaService.notificarProximo(barbeiroId, horaInicio, horaFim);
  } catch (err) {
    console.error("Falha ao processar a fila de espera:", err);
  }
}

// Atualiza o que venceu ANTES de montar a listagem, para nada expirado aparecer como ativo.
async function atualizarEntradasVencidas(clienteId: string) {
  await filaClienteRepository.expirarAguardandoPassadas(clienteId, agoraComoHoraDeParede());

  // 1) o cliente foi avisado e deixou o prazo passar: expira e passa a vez ao próximo
  for (const vencida of await filaClienteRepository.findVencidosDoCliente(clienteId)) {
    await filaDeEsperaRepository.marcarExpirado(vencida.id, vencida.clienteId);
    await avisarProximo(vencida.barbeiroId, vencida.horaInicio, vencida.horaFim);
  }

  // 2) quem está na frente deste cliente também pode ter deixado o prazo passar: deixa a fila andar
  //    (se o horário estiver livre e este cliente for o primeiro, ele é avisado agora)
  for (const aguardando of await filaClienteRepository.findAguardandoDoCliente(clienteId)) {
    await avisarProximo(aguardando.barbeiroId, aguardando.horaInicio, aguardando.horaFim);
  }
}

export const filaDeEsperaClienteService = {
  // GET /fila-de-espera (cliente): entradas com posição, pessoas na frente, prazo e se já pode confirmar
  async listarMinhas(usuarioLogado: AuthPayload) {
    await atualizarEntradasVencidas(usuarioLogado.sub);

    const entradas = await filaClienteRepository.findDoCliente(usuarioLogado.sub);
    const agoraReal = Date.now();
    const agoraDeParede = agoraComoHoraDeParede();

    return Promise.all(
      entradas.map(async (e) => {
        const prazoValido = e.status === "NOTIFICADO" && e.expiraEm !== null && e.expiraEm.getTime() > agoraReal;
        const ativa = e.status === "AGUARDANDO" || prazoValido;
        const naFrente = ativa ? await filaClienteRepository.contarNaFrente(e) : null;

        return {
          id: e.id,
          status: e.status,
          posicao: naFrente === null ? null : naFrente + 1,
          pessoasNaFrente: naFrente,
          expiraEm: e.status === "NOTIFICADO" ? e.expiraEm : null,
          podeConfirmar: prazoValido && e.horaInicio.getTime() >= agoraDeParede.getTime(),
          barbeiro: e.barbeiro,
          servico: e.servico,
          horaInicio: e.horaInicio,
          horaFim: e.horaFim,
          criadoEm: e.criadoEm,
        };
      })
    );
  },

  // GET /fila-de-espera/horarios-elegiveis?barbeiroId=&servicoId=&data=
  // Horários OCUPADOS em que o cliente pode entrar na fila. Elegível = ocupado por agendamento
  // confirmado de OUTRA pessoa, futuro, dentro da disponibilidade (com a duração inteira do serviço),
  // sem bloqueio, sem prioridade ativa na fila, sem conflito com agendamento do próprio cliente e
  // onde o cliente ainda não está na fila. Nunca devolve dados de quem ocupa o horário.
  async horariosElegiveis(
    usuarioLogado: AuthPayload,
    entrada: { barbeiroId: unknown; servicoId: unknown; data: unknown }
  ): Promise<{ data: string; horaInicio: string; horaFim: string }[]> {
    if (usuarioLogado.role !== "CLIENTE") {
      throw new AppError("Apenas clientes podem consultar horários da fila de espera.", 403);
    }
    const { barbeiroId, servicoId, data } = entrada;
    if (typeof barbeiroId !== "string" || !UUID_REGEX.test(barbeiroId)) {
      throw new AppError("barbeiroId é obrigatório e deve ser um id válido.");
    }
    if (typeof servicoId !== "string" || !UUID_REGEX.test(servicoId)) {
      throw new AppError("servicoId é obrigatório e deve ser um id válido.");
    }
    if (typeof data !== "string" || !DATA_REGEX.test(data) || !dataExiste(data)) {
      throw new AppError("data deve estar no formato AAAA-MM-DD.");
    }

    const barbeiro = await filaClienteRepository.findBarbeiroAtivo(barbeiroId);
    if (!barbeiro) {
      throw new AppError("Barbeiro não encontrado.", 404);
    }
    const servico = await filaClienteRepository.findServico(servicoId);
    if (!servico) {
      throw new AppError("Serviço não encontrado.", 404);
    }

    const inicioDoDia = combinarDataHora(data, "00:00");
    const fimDoDia = adicionarMinutos(inicioDoDia, MINUTOS_NO_DIA);
    const agora = agoraComoHoraDeParede();
    if (fimDoDia.getTime() <= agora.getTime()) return []; // dia inteiro no passado

    const [disponibilidades, confirmados, bloqueios, prioridades, minhasNaFila] = await Promise.all([
      disponibilidadesRepository.findByBarbeiro(barbeiroId),
      filaClienteRepository.findConfirmadosComClienteNoPeriodo(barbeiroId, inicioDoDia, fimDoDia),
      filaClienteRepository.findBloqueiosNoPeriodo(barbeiroId, inicioDoDia, fimDoDia),
      filaClienteRepository.findPrioridadesAtivasNoPeriodo(barbeiroId, inicioDoDia, fimDoDia),
      filaClienteRepository.findAtivasDoClienteNoPeriodo(usuarioLogado.sub, barbeiroId, inicioDoDia, fimDoDia),
    ]);

    const faixa = (a: { horaInicio: Date; horaFim: Date }): Faixa => ({ inicio: a.horaInicio, fim: a.horaFim });
    const deOutros = confirmados.filter((c) => c.clienteId !== usuarioLogado.sub).map(faixa);
    const meus = confirmados.filter((c) => c.clienteId === usuarioLogado.sub).map(faixa);
    const reservados = prioridades.map(faixa);
    const periodosBloqueados = bloqueios.map((b) => ({ inicio: b.inicio, fim: b.fim }));

    // Candidatos: os MESMOS horários que o front mostra como livres (grade, duração e "só futuro" vêm de
    // gerarHorariosLivres), mas calculados sem nenhuma ocupação. Depois guardamos só os que estão ocupados
    // por outra pessoa e podem entrar na fila.
    const blocos = disponibilidades.filter((bloco) => bloco.diaSemana === diaDaSemana(data));
    const candidatos = gerarHorariosLivres(data, servico.duracaoMin, blocos, [], agora);

    const resultado: { data: string; horaInicio: string; horaFim: string }[] = [];
    for (const hora of candidatos) {
      const inicio = combinarDataHora(data, hora);
      const fim = adicionarMinutos(inicio, servico.duracaoMin);
      const slot = { inicio, fim };

      if (!deOutros.some((o) => sobrepoe(slot, o))) continue; // não está ocupado (ou é livre)
      if (meus.some((m) => sobrepoe(slot, m))) continue; // conflita com agendamento do próprio cliente
      if (periodosBloqueados.some((b) => sobrepoe(slot, b))) continue; // período bloqueado
      if (reservados.some((r) => sobrepoe(slot, r))) continue; // reservado à fila de espera
      if (minhasNaFila.some((f) => f.horaInicio.getTime() === inicio.getTime())) continue; // já está na fila

      resultado.push({ data, horaInicio: hora, horaFim: formatarHora(fim) });
    }
    return resultado;
  },

  // DELETE /fila-de-espera/:id: o cliente desiste. Se ele já estava avisado, passa a vez ao próximo.
  async desistir(usuarioLogado: AuthPayload, id: string) {
    const entrada = await filaClienteRepository.findById(id);
    if (!entrada) {
      throw new AppError("Entrada na fila de espera não encontrada.", 404);
    }
    if (entrada.clienteId !== usuarioLogado.sub) {
      throw new AppError("Você não tem permissão para alterar esta entrada.", 403);
    }
    if (entrada.status !== "AGUARDANDO" && entrada.status !== "NOTIFICADO") {
      throw new AppError("Esta entrada na fila de espera não está mais ativa.", 400);
    }

    await filaClienteRepository.marcarDesistiu(id);

    if (entrada.status === "NOTIFICADO") {
      await avisarProximo(entrada.barbeiroId, entrada.horaInicio, entrada.horaFim);
    }
  },
};
