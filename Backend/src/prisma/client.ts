import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Pega a URL do seu .env
const connectionString = process.env.DATABASE_URL;

// Cria a pool de conexão nativa do Postgres
const pool = new Pool({ connectionString });

// Passa a pool para o adaptador do Prisma
const adapter = new PrismaPg(pool);

// Instancia o PrismaClient usando o adaptador (exigência do Prisma 7)
export const db = new PrismaClient({ adapter });