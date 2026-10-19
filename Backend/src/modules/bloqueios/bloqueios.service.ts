import type { AuthPayload } from "../../middlewares/authMiddleware.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { db } from "../../prisma/client.js";
import { adicionarMinutos, combinarDataHora } from "../agendamentos/agendamentos.utils.js";
import { bloqueiosRepository } from "./bloqueios.repository.js";

interface CriarBloqueioInput {
  inicio: string; // "2026-10-20" (dia inteiro) ou "2026-10-20T14:00"
  fim: string; // "2026-10-22" (inclui o dia todo) ou "2026-10-20T18:00"
  motivo?: string;
}

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATA_HORA_REGEX = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d$/;

// rejeita datas que não existem (ex.: 2026-02-31, que o Date empurraria para março)
function dataExiste(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

// Aceita "AAAA-MM-DD" ou "AAAA-MM-DDTHH:mm".
// Só a data = dia inteiro: no INÍCIO vale 00:00; no FIM vale até 00:00 do dia seguinte.
function lerMomento(valor: string, campo: string, ehFim: boolean): Date {
  const mensagem = `${campo} deve estar no formato AAAA-MM-DD ou AAAA-MM-DDTHH:mm.`;

  if (typeof valor === "string" && DATA_REGEX.test(valor)) {
    if (!dataExiste(valor)) throw new AppError(`${campo} não é uma data válida.`);
    const dia = combinarDataHora(valor, "00:00");
    return ehFim ? adicionarMinutos(dia, 24 * 60) : dia;
  }

  if (typeof valor === "string" && DATA_HORA_REGEX.test(valor)) {
    const [data, hora] = valor.split("T");
    if (!dataExiste(data)) throw new AppError(`${campo} não é uma data válida.`);
    return combinarDataHora(data, hora);
  }

  throw new AppError(mensagem);
}

// O barbeiro só mexe nos próprios bloqueios; ADMINISTRADOR mexe em qualquer um.
function garantirPermissao(usuarioLogado: AuthPayload, barbeiroId: string) {
  const ehDono = usuarioLogado.role === "BARBEIRO" && usuarioLogado.sub === barbeiroId;
  const ehAdministrador = usuarioLogado.role === "ADMINISTRADOR";
  if (!ehDono && !ehAdministrador) {
    throw new AppError("Você só pode gerenciar os bloqueios da própria agenda.", 403);
  }
}

export const bloqueiosService = {
  async criar(usuarioLogado: AuthPayload, barbeiroId: string, input: CriarBloqueioInput) {
    garantirPermissao(usuarioLogado, barbeiroId);

    const barbeiro = await db.usuario.findFirst({ where: { id: barbeiroId, role: "BARBEIRO" } });
    if (!barbeiro) {
      throw new AppError("Barbeiro não encontrado.", 404);
    }

    const inicio = lerMomento(input.inicio, "inicio", false);
    const fim = lerMomento(input.fim, "fim", true);
    if (fim.getTime() <= inicio.getTime()) {
      throw new AppError("O fim do bloqueio deve ser depois do início.");
    }

    // não bloqueia por cima de atendimentos já marcados: o barbeiro (ou o admin)
    // precisa cancelar ou reagendar esses clientes antes
    const afetados = await bloqueiosRepository.contarAgendamentosConfirmados(
      barbeiroId,
      inicio,
      fim
    );
    if (afetados > 0) {
      throw new AppError(
        `Existem ${afetados} agendamento(s) confirmado(s) nesse período. Cancele ou reagende antes de bloquear.`,
        409
      );
    }

    return bloqueiosRepository.create({ barbeiroId, inicio, fim, motivo: input.motivo });
  },

  listarPorBarbeiro(usuarioLogado: AuthPayload, barbeiroId: string) {
    garantirPermissao(usuarioLogado, barbeiroId);
    return bloqueiosRepository.findByBarbeiro(barbeiroId);
  },

  async remover(usuarioLogado: AuthPayload, id: string) {
    const bloqueio = await bloqueiosRepository.findById(id);
    if (!bloqueio) {
      throw new AppError("Bloqueio não encontrado.", 404);
    }
    garantirPermissao(usuarioLogado, bloqueio.barbeiroId);
    return bloqueiosRepository.delete(id);
  },
};
