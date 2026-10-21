// Popula o banco com dados iniciais. Pode rodar mais de uma vez (não duplica).
//
//   npm run seed
//
// Desenvolvimento: cria admin, 2 clientes, 1 barbeiro (com especialidade e
//   disponibilidade) e 1 serviço. Senha padrão: 123456 (ou SEED_SENHA).
// Produção (NODE_ENV=production): cria SÓ o administrador, e exige
//   SEED_ADMIN_EMAIL e SEED_ADMIN_SENHA definidos no ambiente.
// Este script roda sozinho (fora do servidor), então precisa carregar o .env ele mesmo,
// e isso tem que ser o PRIMEIRO import, antes de o Prisma Client ler o DATABASE_URL.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../prisma/client.js";

const producao = process.env.NODE_ENV === "production";

async function garantirUsuario(dados: {
  nome: string;
  email: string;
  role: "CLIENTE" | "BARBEIRO" | "ADMINISTRADOR";
  senha: string;
  telefone?: string;
}) {
  const existente = await db.usuario.findUnique({ where: { email: dados.email } });
  if (existente) return existente;

  const { senha, ...resto } = dados;
  const senhaHash = await bcrypt.hash(senha, 10);
  return db.usuario.create({ data: { ...resto, senhaHash } });
}

async function main() {
  if (producao) {
    const email = process.env.SEED_ADMIN_EMAIL;
    const senha = process.env.SEED_ADMIN_SENHA;
    if (!email || !senha) {
      throw new Error("Em produção, defina SEED_ADMIN_EMAIL e SEED_ADMIN_SENHA.");
    }
    await garantirUsuario({ nome: "Administrador", email, role: "ADMINISTRADOR", senha });
    console.log(`Administrador garantido: ${email}`);
    return;
  }

  const senha = process.env.SEED_SENHA ?? "123456";

  await garantirUsuario({
    nome: "Administrador",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@barbershop.com",
    role: "ADMINISTRADOR",
    senha,
  });
  await garantirUsuario({ nome: "Cliente Um", email: "cliente@barbershop.com", role: "CLIENTE", senha });
  await garantirUsuario({ nome: "Cliente Dois", email: "cliente2@barbershop.com", role: "CLIENTE", senha });
  const barbeiro = await garantirUsuario({
    nome: "João Barbeiro",
    email: "joao@barbershop.com",
    role: "BARBEIRO",
    telefone: "85999999999",
    senha,
  });

  const servico =
    (await db.servico.findFirst({ where: { nome: "Corte Masculino" } })) ??
    (await db.servico.create({
      data: { nome: "Corte Masculino", descricao: "Corte tradicional", duracaoMin: 30, preco: 40 },
    }));

  const especialidade =
    (await db.especialidade.findUnique({ where: { nome: "Barba" } })) ??
    (await db.especialidade.create({ data: { nome: "Barba" } }));
  await db.barbeiroEspecialidade.createMany({
    data: [{ barbeiroId: barbeiro.id, especialidadeId: especialidade.id }],
    skipDuplicates: true,
  });

  // segunda a sábado, das 09:00 às 18:00 (só se o barbeiro ainda não tem agenda)
  const jaTemAgenda = await db.disponibilidade.count({ where: { barbeiroId: barbeiro.id } });
  if (jaTemAgenda === 0) {
    await db.disponibilidade.createMany({
      data: [1, 2, 3, 4, 5, 6].map((diaSemana) => ({
        barbeiroId: barbeiro.id,
        diaSemana,
        horaInicio: "09:00",
        horaFim: "18:00",
      })),
    });
  }

  console.log("Seed concluído.");
  console.log(`  admin:    admin@barbershop.com / ${senha}`);
  console.log(`  clientes: cliente@barbershop.com, cliente2@barbershop.com / ${senha}`);
  console.log(`  barbeiro: joao@barbershop.com / ${senha}  (id ${barbeiro.id})`);
  console.log(`  serviço:  ${servico.nome} (id ${servico.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());