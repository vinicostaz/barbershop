import bcrypt from "bcryptjs";
import { AppError } from "../../middlewares/errorHandler.js";
import { barbeirosRepository } from "./barbeiros.repository.js";

interface CriarBarbeiroInput {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
}

export const barbeirosService = {
  listar() {
    return barbeirosRepository.findAll();
  },

  async buscarPorId(id: string) {
    const barbeiro = await barbeirosRepository.findById(id);
    if (!barbeiro) {
      throw new AppError("Barbeiro não encontrado.", 404);
    }
    return barbeiro;
  },

  async criar(input: CriarBarbeiroInput) {
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

  async atualizar(id: string, data: Partial<{ nome: string; telefone: string }>) {
    await this.buscarPorId(id);
    return barbeirosRepository.update(id, data);
  },

  async atualizarEspecialidades(id: string, especialidadeIds: string[]) {
    await this.buscarPorId(id);
    if (!Array.isArray(especialidadeIds)) {
      throw new AppError("especialidadeIds deve ser um array de ids.");
    }
    await barbeirosRepository.setEspecialidades(id, especialidadeIds);
    return this.buscarPorId(id);
  },
};
