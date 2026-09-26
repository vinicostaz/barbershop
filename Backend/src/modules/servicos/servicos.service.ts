import { AppError } from "../../middlewares/errorHandler.js";
import { servicosRepository } from "./servicos.repository.js";

interface ServicoInput {
  nome: string;
  descricao?: string;
  duracaoMin: number;
  preco: number;
}

function validar(input: Partial<ServicoInput>) {
  if (input.nome !== undefined && input.nome.trim().length === 0) {
    throw new AppError("O nome do serviço não pode ser vazio.");
  }
  if (input.duracaoMin !== undefined && input.duracaoMin <= 0) {
    throw new AppError("A duração do serviço deve ser maior que zero.");
  }
  if (input.preco !== undefined && input.preco < 0) {
    throw new AppError("O preço do serviço não pode ser negativo.");
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
    validar(input);
    return servicosRepository.create(input);
  },

  async atualizar(id: string, input: Partial<ServicoInput>) {
    validar(input);
    await this.buscarPorId(id); // garante 404 antes de tentar atualizar
    return servicosRepository.update(id, input);
  },

  async remover(id: string) {
    await this.buscarPorId(id);
    return servicosRepository.delete(id);
  },
};
