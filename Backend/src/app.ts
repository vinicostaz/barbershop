import cors from "cors";
import express from "express";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
// próximos módulos entram aqui, ex:
// app.use("/servicos", servicosRoutes);
// app.use("/especialidades", especialidadesRoutes);

// o error handler tem que ser o ÚLTIMO middleware registrado
app.use(errorHandler);
