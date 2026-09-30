-- Impede que o mesmo barbeiro tenha dois agendamentos CONFIRMADO
-- com horários que se sobrepõem, garantido pelo próprio banco
-- (funciona mesmo com duas requisições simultâneas).

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE agendamentos
  ADD CONSTRAINT sem_conflito_horario
  EXCLUDE USING gist (
    "barbeiroId" WITH =,
    tsrange("horaInicio", "horaFim") WITH &&
  )
  WHERE (status = 'CONFIRMADO');