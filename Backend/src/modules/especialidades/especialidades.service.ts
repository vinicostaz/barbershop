import { AppError } from "../../middlewares/errorHandler.js";
import { especialidadesRepository } from "./especialidades.repository.js";

export const especialidadesService = {
  listar() {
    return especialidadesRepository.findAll();
  },

  async buscarPorId(id: string) {
    const especialidade = await especialidadesRepository.findById(id);
    if (!especialidade) {
      throw new AppError("Especialidade não encontrada.", 404);
    }
    return especialidade;
  },

  async criar(nome: string) {
    if (typeof nome !== "string" || nome.trim().length === 0) {
      throw new AppError("O nome da especialidade não pode ser vazio.");
    }
    const nomeNormalizado = nome.trim();
    const existente = await especialidadesRepository.findByNome(nomeNormalizado);
    if (existente) {
      throw new AppError("Já existe uma especialidade com esse nome.", 409);
    }
    return especialidadesRepository.create({ nome: nomeNormalizado });
  },

  async atualizar(id: string, nome: string) {
    await this.buscarPorId(id);
    if (typeof nome !== "string" || nome.trim().length === 0) {
      throw new AppError("O nome da especialidade não pode ser vazio.");
    }
    const nomeNormalizado = nome.trim();
    const existente = await especialidadesRepository.findByNome(nomeNormalizado);
    if (existente && existente.id !== id) {
      throw new AppError("Já existe uma especialidade com esse nome.", 409);
    }
    return especialidadesRepository.update(id, { nome: nomeNormalizado });
  },

  async remover(id: string) {
    await this.buscarPorId(id);
    return especialidadesRepository.delete(id);
  },
};
