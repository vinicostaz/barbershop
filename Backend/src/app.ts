import cors from "cors";
import express from "express";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { especialidadesRoutes } from "./modules/especialidades/especialidades.routes.js";
import { servicosRoutes } from "./modules/servicos/servicos.routes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
app.use("/servicos", servicosRoutes);
app.use("/especialidades", especialidadesRoutes);
// próximos módulos entram aqui, ex:
// app.use("/agendamentos", agendamentosRoutes);

// o error handler tem que ser o ÚLTIMO middleware registrado
app.use(errorHandler);
