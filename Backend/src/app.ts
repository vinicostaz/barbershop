import cors from "cors";
import express from "express";
import { errorHandler } from "./middlewares/errorHandler.js";
import { agendamentosRoutes } from "./modules/agendamentos/agendamentos.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { barbeirosRoutes } from "./modules/barbeiros/barbeiros.routes.js";
import { disponibilidadesRoutes } from "./modules/disponibilidades/disponibilidades.routes.js";
import { especialidadesRoutes } from "./modules/especialidades/especialidades.routes.js";
import { servicosRoutes } from "./modules/servicos/servicos.routes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
app.use("/servicos", servicosRoutes);
app.use("/especialidades", especialidadesRoutes);
app.use("/barbeiros", barbeirosRoutes);
app.use("/disponibilidades", disponibilidadesRoutes);
app.use("/agendamentos", agendamentosRoutes);

// o error handler tem que ser o ÚLTIMO middleware registrado
app.use(errorHandler);
