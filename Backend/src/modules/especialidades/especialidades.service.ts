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
    if (!nome || nome.trim().length === 0) {
      throw new AppError("O nome da especialidade não pode ser vazio.");
    }
    const existente = await especialidadesRepository.findByNome(nome);
    if (existente) {
      throw new AppError("Já existe uma especialidade com esse nome.", 409);
    }
    return especialidadesRepository.create({ nome });
  },

  async atualizar(id: string, nome: string) {
    await this.buscarPorId(id);
    return especialidadesRepository.update(id, { nome });
  },

  async remover(id: string) {
    await this.buscarPorId(id);
    return especialidadesRepository.delete(id);
  },
};
