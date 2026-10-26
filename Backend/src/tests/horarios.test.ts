import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "../middlewares/errorHandler.js";
import { calcularHorario, validarData } from "../modules/agendamentos/agendamentos.horario.js";
import { combinarDataHora } from "../modules/agendamentos/agendamentos.utils.js";
import { gerarHorariosLivres } from "../modules/disponibilidades/disponibilidades.service.js";

const todosOsHorariosSaoFuturos = combinarDataHora("2026-10-01", "00:00");

describe("validação de datas e horários", () => {
  it("recusa datas que não existem", () => {
    assert.throws(
      () => validarData("2026-02-31"),
      (erro) => erro instanceof AppError && erro.message === "Data inválida."
    );
  });

  it("recusa duração inválida", () => {
    assert.throws(
      () => calcularHorario("2099-01-10", "09:00", 0),
      (erro) => erro instanceof AppError && erro.message.includes("duração")
    );
  });
});

describe("geração de horários disponíveis", () => {
  it("remove qualquer horário cuja duração se sobreponha a um agendamento", () => {
    const horarios = gerarHorariosLivres(
      "2026-10-20",
      30,
      [{ diaSemana: 2, horaInicio: "09:00", horaFim: "12:00" }],
      [
        {
          horaInicio: combinarDataHora("2026-10-20", "10:00"),
          horaFim: combinarDataHora("2026-10-20", "10:45"),
        },
      ],
      todosOsHorariosSaoFuturos
    );

    assert.ok(horarios.includes("09:30"));
    assert.ok(horarios.includes("10:45"));
    assert.ok(!horarios.includes("09:45"));
    assert.ok(!horarios.includes("10:00"));
    assert.ok(!horarios.includes("10:15"));
    assert.ok(!horarios.includes("10:30"));
  });

  it("trata bloqueios como intervalos indisponíveis", () => {
    const horarios = gerarHorariosLivres(
      "2026-10-20",
      45,
      [{ diaSemana: 2, horaInicio: "09:00", horaFim: "11:00" }],
      [
        {
          horaInicio: combinarDataHora("2026-10-20", "09:30"),
          horaFim: combinarDataHora("2026-10-20", "10:15"),
        },
      ],
      todosOsHorariosSaoFuturos
    );

    assert.deepEqual(horarios, ["10:15"]);
  });

  it("não devolve horários que já passaram", () => {
    const horarios = gerarHorariosLivres(
      "2026-10-20",
      30,
      [{ diaSemana: 2, horaInicio: "09:00", horaFim: "11:00" }],
      [],
      combinarDataHora("2026-10-20", "10:07")
    );

    assert.deepEqual(horarios, ["10:15", "10:30"]);
  });

  it("não apresenta um dia quando nenhum serviço cabe no bloco", () => {
    const horarios = gerarHorariosLivres(
      "2026-10-20",
      60,
      [{ diaSemana: 2, horaInicio: "09:00", horaFim: "09:45" }],
      [],
      todosOsHorariosSaoFuturos
    );

    assert.deepEqual(horarios, []);
  });
});
