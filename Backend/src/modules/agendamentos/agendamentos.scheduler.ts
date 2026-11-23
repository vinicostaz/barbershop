import { agendamentosService } from "./agendamentos.service.js";

const INTERVALO_CONCLUSAO_MS = 60_000;

export function iniciarConclusaoAutomatica() {
  let executando = false;

  async function concluirEncerrados() {
    if (executando) return;
    executando = true;

    try {
      const total = await agendamentosService.concluirEncerrados();
      if (total > 0) {
        console.log(`${total} atendimento(s) concluído(s) automaticamente.`);
      }
    } catch (erro) {
      console.error("Falha ao concluir atendimentos automaticamente:", erro);
    } finally {
      executando = false;
    }
  }

  void concluirEncerrados();
  const timer = setInterval(() => void concluirEncerrados(), INTERVALO_CONCLUSAO_MS);
  timer.unref();

  return () => clearInterval(timer);
}
