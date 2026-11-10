import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "../middlewares/errorHandler.js";
import { periodoDoMes } from "../modules/dashboard/dashboard.service.js";

describe("período do dashboard", () => {
  it("gera o intervalo mensal em UTC", () => {
    const periodo = periodoDoMes("2026-11");
    assert.equal(periodo.inicio.toISOString(), "2026-11-01T00:00:00.000Z");
    assert.equal(periodo.fim.toISOString(), "2026-12-01T00:00:00.000Z");
  });

  it("aceita dezembro e avança para janeiro do próximo ano", () => {
    const periodo = periodoDoMes("2026-12");
    assert.equal(periodo.fim.toISOString(), "2027-01-01T00:00:00.000Z");
  });

  it("recusa mês ausente ou inválido", () => {
    for (const mes of [undefined, "2026-00", "2026-13", "11/2026", "2026-1"]) {
      assert.throws(() => periodoDoMes(mes), AppError);
    }
  });
});
