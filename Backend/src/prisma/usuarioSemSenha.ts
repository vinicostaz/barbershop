// Usar em todo `include`/consulta que devolve um Usuario para o cliente da API.
// Sem isso, o Prisma devolve o registro completo, inclusive o hash da senha.
//
//   include: { cliente: usuarioSemSenha }          // dentro de um include
//   db.usuario.findMany({ ...usuarioSemSenha })    // na consulta direta
export const usuarioSemSenha = { omit: { senhaHash: true } } as const;

// Relações devolvidas em agendamentos e na fila precisam apenas identificar a
// pessoa. E-mail, telefone, pontos e demais dados da conta não saem nesses payloads.
export const usuarioResumo = {
  select: { id: true, nome: true, role: true, ativo: true },
} as const;
