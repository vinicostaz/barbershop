import { AppError } from "../../middlewares/errorHandler.js";
import { servicosRepository } from "./servicos.repository.js";

interface ServicoInput {
  nome: string;
  descricao?: string;
  duracaoMin: number;
  preco: number;
}

function validar(input: Partial<ServicoInput>, completo = false) {
  if (completo && typeof input.nome !== "string") {
    throw new AppError("O nome do serviço é obrigatório.");
  }
  if (input.nome !== undefined && (typeof input.nome !== "string" || input.nome.trim().length === 0)) {
    throw new AppError("O nome do serviço não pode ser vazio.");
  }
  if (completo && input.duracaoMin === undefined) {
    throw new AppError("A duração do serviço é obrigatória.");
  }
  if (
    input.duracaoMin !== undefined &&
    (!Number.isInteger(input.duracaoMin) || input.duracaoMin <= 0)
  ) {
    throw new AppError("A duração do serviço deve ser um número inteiro maior que zero.");
  }
  if (completo && input.preco === undefined) {
    throw new AppError("O preço do serviço é obrigatório.");
  }
  if (
    input.preco !== undefined &&
    (typeof input.preco !== "number" || !Number.isFinite(input.preco) || input.preco < 0)
  ) {
    throw new AppError("O preço do serviço não pode ser negativo.");
  }
  if (input.descricao !== undefined && typeof input.descricao !== "string") {
    throw new AppError("A descrição do serviço deve ser um texto.");
  }
}

export const servicosService = {
  listar() {
    return servicosRepository.findAll();
  },

  async buscarPorId(id: string) {
    const servico = await servicosRepository.findById(id);
    if (!servico) {
      throw new AppError("Serviço não encontrado.", 404);
    }
    return servico;
  },

  criar(input: ServicoInput) {
    validar(input, true);
    return servicosRepository.create({ ...input, nome: input.nome.trim() });
  },

  async atualizar(id: string, input: Partial<ServicoInput>) {
    validar(input);
    await this.buscarPorId(id); // garante 404 antes de tentar atualizar
    const dados: Partial<ServicoInput> = {};
    if (input.nome !== undefined) dados.nome = input.nome.trim();
    if (input.descricao !== undefined) dados.descricao = input.descricao.trim();
    if (input.duracaoMin !== undefined) dados.duracaoMin = input.duracaoMin;
    if (input.preco !== undefined) dados.preco = input.preco;
    if (Object.keys(dados).length === 0) {
      throw new AppError("Informe ao menos um campo para atualizar.");
    }
    return servicosRepository.update(id, dados);
  },

  async remover(id: string) {
    await this.buscarPorId(id);
    const usos = await servicosRepository.contarUsos(id);
    if (usos > 0) {
      throw new AppError(
        "Este serviço possui agendamentos ou entradas na fila e não pode ser removido.",
        409
      );
    }
    return servicosRepository.delete(id);
  },
};
