import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "../middlewares/errorHandler.js";
import { validarAvaliacao } from "../modules/avaliacoes/avaliacoes.service.js";

describe("validação da avaliação", () => {
  it("aceita nota de 1 a 5 e limpa o comentário", () => {
    assert.deepEqual(validarAvaliacao({ agendamentoId: "a1", nota: 5, comentario: "  Ótimo corte!  " }), {
      agendamentoId: "a1",
      nota: 5,
      comentario: "Ótimo corte!",
    });
  });

  it("comentário vazio ou ausente vira sem comentário", () => {
    assert.equal(validarAvaliacao({ agendamentoId: "a1", nota: 1, comentario: "   " }).comentario, undefined);
    assert.equal(validarAvaliacao({ agendamentoId: "a1", nota: 3 }).comentario, undefined);
  });

  it("recusa nota fora de 1 a 5, quebrada ou como texto", () => {
    for (const nota of [0, 6, 4.5, "5", undefined]) {
      assert.throws(() => validarAvaliacao({ agendamentoId: "a1", nota }), AppError);
    }
  });

  it("recusa comentário que não é texto ou muito longo", () => {
    assert.throws(() => validarAvaliacao({ agendamentoId: "a1", nota: 4, comentario: 10 }), AppError);
    assert.throws(() => validarAvaliacao({ agendamentoId: "a1", nota: 4, comentario: "a".repeat(501) }), AppError);
  });

  it("exige agendamentoId", () => {
    assert.throws(() => validarAvaliacao({ agendamentoId: "", nota: 4 }), AppError);
  });
});
