import bcrypt from "bcryptjs";
import { AppError } from "../../middlewares/errorHandler.js";
import { agoraComoHoraDeParede } from "../agendamentos/agendamentos.tempo.js";
import { barbeirosRepository } from "./barbeiros.repository.js";

interface CriarBarbeiroInput {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
}

export const barbeirosService = {
  // público: só barbeiros ativos. Admin usa listar(true) para ver todos.
  listar(incluirInativos = false) {
    return barbeirosRepository.findAll(incluirInativos);
  },

  async buscarPorId(id: string, incluirInativos = false) {
    const barbeiro = await barbeirosRepository.findById(id, incluirInativos);
    if (!barbeiro) {
      throw new AppError("Barbeiro não encontrado.", 404);
    }
    return barbeiro;
  },

  async criar(input: CriarBarbeiroInput) {
    if (typeof input.nome !== "string" || input.nome.trim().length === 0) {
      throw new AppError("O nome é obrigatório.");
    }
    if (typeof input.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new AppError("Informe um e-mail válido.");
    }
    if (typeof input.senha !== "string" || input.senha.length < 6) {
      throw new AppError("A senha deve ter pelo menos 6 caracteres.");
    }

    const existente = await barbeirosRepository.findByEmail(input.email);
    if (existente) {
      throw new AppError("Já existe um usuário cadastrado com este e-mail.", 409);
    }

    const senhaHash = await bcrypt.hash(input.senha, 10);
    return barbeirosRepository.create({
      nome: input.nome,
      email: input.email,
      senhaHash,
      telefone: input.telefone,
    });
  },

  // Só nome e telefone são editáveis aqui. Ignora qualquer outro campo do body
  // (role, email, senhaHash, ativo...), que não devem mudar por este endpoint.
  async atualizar(id: string, data: { nome?: string; telefone?: string }) {
    await this.buscarPorId(id, true);

    const dados: { nome?: string; telefone?: string } = {};
    if (data?.nome !== undefined) {
      if (typeof data.nome !== "string" || data.nome.trim().length === 0) {
        throw new AppError("O nome não pode ser vazio.");
      }
      dados.nome = data.nome;
    }
    if (data?.telefone !== undefined) {
      dados.telefone = data.telefone;
    }
    return barbeirosRepository.update(id, dados);
  },

  async atualizarEspecialidades(id: string, especialidadeIds: string[]) {
    await this.buscarPorId(id, true);
    if (!Array.isArray(especialidadeIds)) {
      throw new AppError("especialidadeIds deve ser um array de ids.");
    }
    await barbeirosRepository.setEspecialidades(id, especialidadeIds);
    return this.buscarPorId(id, true);
  },

  // Desativar em vez de apagar: o histórico de agendamentos continua íntegro.
  async alterarAtivo(id: string, ativo: unknown) {
    if (typeof ativo !== "boolean") {
      throw new AppError("ativo deve ser true ou false.");
    }
    await this.buscarPorId(id, true);

    if (!ativo) {
      // mesma regra do bloqueio de períodos: não deixa clientes com horário "fantasma"
      const futuros = await barbeirosRepository.contarAgendamentosFuturos(
        id,
        agoraComoHoraDeParede()
      );
      if (futuros > 0) {
        throw new AppError(
          `Existem ${futuros} agendamento(s) confirmado(s) futuros com este barbeiro. Cancele ou reagende antes de desativar.`,
          409
        );
      }
    }

    return barbeirosRepository.setAtivo(id, ativo);
  },
};
