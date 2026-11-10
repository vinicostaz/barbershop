import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "../middlewares/errorHandler.js";
import { normalizarDiasSemana } from "../modules/disponibilidades/disponibilidades.service.js";

describe("disponibilidade em vários dias (diasSemana)", () => {
  it("ordena e remove dias repetidos", () => {
    assert.deepEqual(normalizarDiasSemana([6, 1, 3, 1]), [1, 3, 6]);
  });

  it("recusa lista vazia ou que não é lista", () => {
    for (const valor of [[], undefined, 1, "1,2"]) {
      assert.throws(() => normalizarDiasSemana(valor), AppError);
    }
  });

  it("recusa dias fora de 0 a 6 ou que não são inteiros", () => {
    for (const valor of [[7], [-1], [1.5], ["1"]]) {
      assert.throws(() => normalizarDiasSemana(valor), AppError);
    }
  });
});
