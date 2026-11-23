// Popula o banco com dados iniciais. Pode rodar mais de uma vez (não duplica).
//
//   npm run seed
//
// Desenvolvimento: cria uma massa demonstrativa completa e idempotente, com
//   profissionais, serviços, clientes, agenda de vários meses e avaliações.
//   Senha padrão: 123456 (ou SEED_SENHA).
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

async function garantirServico(dados: {
  nome: string;
  descricao: string;
  duracaoMin: number;
  preco: number;
}) {
  return (
    (await db.servico.findFirst({ where: { nome: dados.nome } })) ??
    db.servico.create({ data: dados })
  );
}

async function garantirEspecialidade(nome: string) {
  return (
    (await db.especialidade.findUnique({ where: { nome } })) ??
    db.especialidade.create({ data: { nome } })
  );
}

async function garantirAgenda(barbeiroId: string) {
  const quantidade = await db.disponibilidade.count({ where: { barbeiroId } });
  if (quantidade > 0) return;

  await db.disponibilidade.createMany({
    data: [1, 2, 3, 4, 5, 6].map((diaSemana) => ({
      barbeiroId,
      diaSemana,
      horaInicio: "09:00",
      horaFim: "18:00",
    })),
  });
}

function horario(ano: number, mes: number, dia: number, hora: string) {
  const [horas, minutos] = hora.split(":").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, horas, minutos));
}

async function garantirAgendamento(dados: {
  ano: number;
  mes: number;
  dia: number;
  hora: string;
  clienteId: string;
  barbeiroId: string;
  servico: { id: string; duracaoMin: number };
  status: "CONFIRMADO" | "CANCELADO" | "CONCLUIDO" | "REAGENDADO";
}) {
  const horaInicio = horario(dados.ano, dados.mes, dados.dia, dados.hora);
  const horaFim = new Date(horaInicio.getTime() + dados.servico.duracaoMin * 60_000);
  const existente = await db.agendamento.findFirst({
    where: {
      clienteId: dados.clienteId,
      barbeiroId: dados.barbeiroId,
      servicoId: dados.servico.id,
      horaInicio,
    },
  });
  if (existente) return existente;

  return db.agendamento.create({
    data: {
      clienteId: dados.clienteId,
      barbeiroId: dados.barbeiroId,
      servicoId: dados.servico.id,
      data: horario(dados.ano, dados.mes, dados.dia, "00:00"),
      horaInicio,
      horaFim,
      status: dados.status,
    },
  });
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
  const clientes = await Promise.all([
    garantirUsuario({ nome: "Cliente Um", email: "cliente@barbershop.com", role: "CLIENTE", senha }),
    garantirUsuario({ nome: "Cliente Dois", email: "cliente2@barbershop.com", role: "CLIENTE", senha }),
    garantirUsuario({ nome: "Mariana Souza", email: "mariana@barbershop.com", role: "CLIENTE", senha }),
    garantirUsuario({ nome: "Rafael Lima", email: "rafael@barbershop.com", role: "CLIENTE", senha }),
    garantirUsuario({ nome: "Bruno Alves", email: "bruno@barbershop.com", role: "CLIENTE", senha }),
    garantirUsuario({ nome: "Felipe Rocha", email: "felipe@barbershop.com", role: "CLIENTE", senha }),
  ]);

  const barbeiros = await Promise.all([
    garantirUsuario({
      nome: "João Barbeiro",
      email: "joao@barbershop.com",
      role: "BARBEIRO",
      telefone: "85999999999",
      senha,
    }),
    garantirUsuario({
      nome: "Carlos Almeida",
      email: "carlos@barbershop.com",
      role: "BARBEIRO",
      telefone: "85988887777",
      senha,
    }),
    garantirUsuario({
      nome: "Lucas Mendes",
      email: "lucas@barbershop.com",
      role: "BARBEIRO",
      telefone: "85977776666",
      senha,
    }),
  ]);

  const servicos = await Promise.all([
    garantirServico({ nome: "Corte Masculino", descricao: "Corte tradicional ou moderno.", duracaoMin: 30, preco: 40 }),
    garantirServico({ nome: "Barba Completa", descricao: "Modelagem, toalha quente e acabamento.", duracaoMin: 30, preco: 35 }),
    garantirServico({ nome: "Corte + Barba", descricao: "Experiência completa de corte e barba.", duracaoMin: 60, preco: 70 }),
    garantirServico({ nome: "Degradê Premium", descricao: "Degradê detalhado com acabamento preciso.", duracaoMin: 45, preco: 55 }),
    garantirServico({ nome: "Corte Infantil", descricao: "Atendimento cuidadoso para crianças.", duracaoMin: 30, preco: 35 }),
    garantirServico({ nome: "Sobrancelha", descricao: "Alinhamento e acabamento de sobrancelha.", duracaoMin: 15, preco: 20 }),
  ]);

  const especialidades = new Map(
    await Promise.all(
      ["Barba", "Corte clássico", "Degradê", "Visagismo", "Infantil"].map(async (nome) => {
        const especialidade = await garantirEspecialidade(nome);
        return [nome, especialidade] as const;
      })
    )
  );
  const especialidadesPorBarbeiro = [
    ["Barba", "Corte clássico"],
    ["Degradê", "Visagismo"],
    ["Corte clássico", "Infantil"],
  ];

  for (const [indice, barbeiro] of barbeiros.entries()) {
    await db.barbeiroEspecialidade.createMany({
      data: especialidadesPorBarbeiro[indice].map((nome) => ({
        barbeiroId: barbeiro.id,
        especialidadeId: especialidades.get(nome)!.id,
      })),
      skipDuplicates: true,
    });
    await garantirAgenda(barbeiro.id);
  }

  const comentarios = [
    "Atendimento excelente e corte muito bem feito.",
    "Profissional pontual e cuidadoso.",
    "Gostei bastante do resultado.",
    "Ambiente agradável e ótimo atendimento.",
    "Acabamento impecável, voltarei mais vezes.",
    "Serviço rápido e de muita qualidade.",
  ];
  const notas = [5, 4, 5, 3, 4, 5];
  const meses = [8, 9, 10, 11];
  let agendamentosCriados = 0;
  let avaliacoesCriadas = 0;

  for (const [indiceMes, mes] of meses.entries()) {
    for (let indice = 0; indice < 10; indice += 1) {
      const status =
        indice === 7 || indice === 8
          ? "CANCELADO"
          : indice === 9
            ? "REAGENDADO"
            : "CONCLUIDO";
      const cliente = clientes[(indice + indiceMes) % clientes.length];
      const barbeiro = barbeiros[(indice * 2 + indiceMes) % barbeiros.length];
      const servico = servicos[(indice + indiceMes * 2) % servicos.length];
      const agendamento = await garantirAgendamento({
        ano: 2026,
        mes,
        dia: 2 + indice * 2,
        hora: ["09:00", "10:30", "13:00", "14:30", "16:00"][indice % 5],
        clienteId: cliente.id,
        barbeiroId: barbeiro.id,
        servico,
        status,
      });
      agendamentosCriados += 1;

      if (status === "CONCLUIDO" && (indice + indiceMes) % 4 !== 0) {
        const existente = await db.avaliacao.findUnique({
          where: { agendamentoId: agendamento.id },
        });
        if (!existente) {
          await db.avaliacao.create({
            data: {
              agendamentoId: agendamento.id,
              clienteId: cliente.id,
              nota: notas[(indice + indiceMes) % notas.length],
              comentario: comentarios[(indice + indiceMes) % comentarios.length],
              criadoEm: new Date(agendamento.horaFim.getTime() + 60 * 60_000),
            },
          });
          avaliacoesCriadas += 1;
        }
      }
    }
  }

  // Agenda futura para deixar a operação e a visão de próximos atendimentos preenchidas.
  for (let indice = 0; indice < 5; indice += 1) {
    await garantirAgendamento({
      ano: 2026,
      mes: 11,
      dia: 25 + indice,
      hora: ["09:30", "11:00", "13:30", "15:00", "16:30"][indice],
      clienteId: clientes[indice % clientes.length].id,
      barbeiroId: barbeiros[indice % barbeiros.length].id,
      servico: servicos[indice % servicos.length],
      status: "CONFIRMADO",
    });
    agendamentosCriados += 1;
  }

  // Mantém o saldo demonstrativo coerente sem reduzir pontos que já existam.
  for (const cliente of clientes) {
    const concluidos = await db.agendamento.count({
      where: { clienteId: cliente.id, status: "CONCLUIDO" },
    });
    if (cliente.pontosFidelidade < concluidos) {
      await db.usuario.update({
        where: { id: cliente.id },
        data: { pontosFidelidade: concluidos },
      });
    }
  }

  console.log("Seed concluído.");
  console.log(`  admin:    admin@barbershop.com / ${senha}`);
  console.log(`  clientes: ${clientes.length} contas com senha ${senha}`);
  console.log(`  barbeiros: ${barbeiros.length} contas com senha ${senha}`);
  console.log(`  serviços:  ${servicos.length}`);
  console.log(`  agendamentos demonstrativos garantidos: ${agendamentosCriados}`);
  console.log(`  novas avaliações criadas nesta execução: ${avaliacoesCriadas}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
