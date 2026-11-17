import { app } from "./app.js";
import { env } from "./config/env.js";
import { iniciarConclusaoAutomatica } from "./modules/agendamentos/agendamentos.scheduler.js";

iniciarConclusaoAutomatica();

app.listen(env.port, () => {
  console.log(`Servidor rodando em http://localhost:${env.port}`);
});
