#!/usr/bin/env bash

set -Eeuo pipefail

PG_CTL_BIN="${BARBERSHOP_PG_CTL:-/usr/lib/postgresql/16/bin/pg_ctl}"
PG_DATA_DIR="${BARBERSHOP_PG_DATA:-${XDG_DATA_HOME:-$HOME/.local/share}/barbershop-postgres/data}"
PG_LOG_FILE="${BARBERSHOP_PG_LOG:-${PG_DATA_DIR}/../postgres.log}"
PG_PORT="${BARBERSHOP_PG_PORT:-5433}"
PG_SOCKET_DIR="${BARBERSHOP_PG_SOCKET:-/tmp/barbershop-pg-socket}"

postgres_started=0

stop_postgres() {
  exit_code=$?
  trap - EXIT INT TERM

  if [[ "$postgres_started" -eq 1 ]]; then
    echo
    echo "Encerrando PostgreSQL..."
    "$PG_CTL_BIN" -D "$PG_DATA_DIR" stop -m fast
  fi

  exit "$exit_code"
}

trap stop_postgres EXIT INT TERM

if [[ ! -x "$PG_CTL_BIN" ]]; then
  echo "Erro: pg_ctl não encontrado em $PG_CTL_BIN" >&2
  echo "Defina BARBERSHOP_PG_CTL com o caminho correto." >&2
  exit 1
fi

if [[ ! -d "$PG_DATA_DIR" ]]; then
  echo "Erro: diretório do PostgreSQL não encontrado em $PG_DATA_DIR" >&2
  echo "Defina BARBERSHOP_PG_DATA com o caminho correto." >&2
  exit 1
fi

mkdir -p "$PG_SOCKET_DIR"

if "$PG_CTL_BIN" -D "$PG_DATA_DIR" status >/dev/null 2>&1; then
  echo "PostgreSQL já está em execução."
else
  echo "Iniciando PostgreSQL na porta $PG_PORT..."
  "$PG_CTL_BIN" \
    -D "$PG_DATA_DIR" \
    -l "$PG_LOG_FILE" \
    -o "-p $PG_PORT -h 127.0.0.1 -k $PG_SOCKET_DIR" \
    start
  postgres_started=1
fi

echo "Iniciando backend..."
tsx watch src/server.ts
