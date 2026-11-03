import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { combinarDataHora } from "../modules/agendamentos/agendamentos.utils.js";
import { consolidarBloqueios } from "../modules/bloqueios/bloqueios.service.js";
import { contarAgendamentosForaDoExpediente } from "../modules/disponibilidades/disponibilidades.service.js";

// 2026-10-20 é uma terça-feira (diaSemana = 2)
const agendamento = (inicio: string, fim: string) => ({
  horaInicio: combinarDataHora("2026-10-20", inicio),
  horaFim: combinarDataHora("2026-10-20", fim),
});
const terca = (horaInicio: string, horaFim: string) => ({ diaSemana: 2, horaInicio, horaFim });

describe("agendamentos fantasmas (disponibilidade)", () => {
  const blocoAtual = terca("09:00", "18:00");
  const agendamentos = [agendamento("09:00", "09:30"), agendamento("17:00", "17:45")];

  it("remover o bloco conta todos os agendamentos que estavam nele", () => {
    assert.equal(contarAgendamentosForaDoExpediente(agendamentos, blocoAtual, []), 2);
  });

  it("encurtar o expediente conta só quem ficou de fora", () => {
    assert.equal(
      contarAgendamentosForaDoExpediente(agendamentos, blocoAtual, [terca("09:00", "17:30")]),
      1
    );
  });

  it("ampliar o expediente não afeta ninguém", () => {
    assert.equal(
      contarAgendamentosForaDoExpediente(agendamentos, blocoAtual, [terca("08:00", "20:00")]),
      0
    );
  });

  it("trocar o dia da semana deixa os agendamentos daquele dia de fora", () => {
    assert.equal(
      contarAgendamentosForaDoExpediente(agendamentos, blocoAtual, [
        { diaSemana: 3, horaInicio: "09:00", horaFim: "18:00" },
      ]),
      2
    );
  });

  it("ignora agendamentos que não estavam no bloco alterado", () => {
    assert.equal(
      contarAgendamentosForaDoExpediente([agendamento("19:00", "19:30")], blocoAtual, []),
      0
    );
  });
});

describe("consolidação de bloqueios sobrepostos", () => {
  const momento = (hora: string) => combinarDataHora("2026-10-20", hora);

  it("junta os períodos do menor início ao maior fim", () => {
    const resultado = consolidarBloqueios({ inicio: momento("11:00"), fim: momento("15:00") }, [
      { inicio: momento("10:00"), fim: momento("12:00"), motivo: "Médico" },
      { inicio: momento("14:00"), fim: momento("16:00"), motivo: null },
    ]);
    assert.deepEqual(resultado, {
      inicio: momento("10:00"),
      fim: momento("16:00"),
      motivo: "Médico",
    });
  });

  it("mantém motivos diferentes sem repetir", () => {
    const resultado = consolidarBloqueios(
      { inicio: momento("12:00"), fim: momento("14:00"), motivo: "Almoço" },
      [
        { inicio: momento("10:00"), fim: momento("12:00"), motivo: "Médico" },
        { inicio: momento("13:00"), fim: momento("13:30"), motivo: "Almoço" },
      ]
    );
    assert.equal(resultado.motivo, "Almoço; Médico");
  });
});
