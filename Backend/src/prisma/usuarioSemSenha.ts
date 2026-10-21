// Usar em todo `include`/consulta que devolve um Usuario para o cliente da API.
// Sem isso, o Prisma devolve o registro completo, inclusive o hash da senha.
//
//   include: { cliente: usuarioSemSenha }          // dentro de um include
//   db.usuario.findMany({ ...usuarioSemSenha })    // na consulta direta
export const usuarioSemSenha = { omit: { senhaHash: true } } as const;
