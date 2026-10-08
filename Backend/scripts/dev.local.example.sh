#!/usr/bin/env bash

# Copie para scripts/dev.local.sh e informe as configurações da sua instalação.
# Este script é opcional e serve apenas para o ambiente de desenvolvimento local.
#
# Variável obrigatória:
#   BARBERSHOP_PG_DATA=/caminho/para/o/diretorio/de/dados
#
# Variáveis opcionais:
#   BARBERSHOP_PG_CTL=/caminho/para/pg_ctl
#   BARBERSHOP_PG_LOG=/caminho/para/postgres.log
#   BARBERSHOP_PG_PORT=5432
#   BARBERSHOP_PG_SOCKET=/caminho/para/o/socket

set -Eeuo pipefail

PG_CTL_BIN="${BARBERSHOP_PG_CTL:-}"
PG_DATA_DIR="${BARBERSHOP_PG_DATA:-}"
PG_PORT="${BARBERSHOP_PG_PORT:-5432}"
PG_SOCKET_DIR="${BARBERSHOP_PG_SOCKET:-${XDG_RUNTIME_DIR:-/tmp}/barbershop-pg-$UID}"

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

if [[ -z "$PG_CTL_BIN" ]]; then
  PG_CTL_BIN="$(command -v pg_ctl || true)"
fi

if [[ -z "$PG_CTL_BIN" ]]; then
  echo "Erro: pg_ctl não foi encontrado no PATH." >&2
  echo "Defina BARBERSHOP_PG_CTL em scripts/dev.local.sh." >&2
  exit 1
fi

if [[ ! -x "$PG_CTL_BIN" ]]; then
  echo "Erro: pg_ctl não encontrado em $PG_CTL_BIN" >&2
  echo "Ajuste BARBERSHOP_PG_CTL ou edite scripts/dev.local.sh." >&2
  exit 1
fi

if [[ -z "$PG_DATA_DIR" ]]; then
  echo "Erro: BARBERSHOP_PG_DATA não foi configurado." >&2
  echo "Informe o diretório de dados em scripts/dev.local.sh." >&2
  exit 1
fi

if [[ ! -d "$PG_DATA_DIR" ]]; then
  echo "Erro: diretório do PostgreSQL não encontrado em $PG_DATA_DIR" >&2
  echo "Ajuste BARBERSHOP_PG_DATA ou edite scripts/dev.local.sh." >&2
  exit 1
fi

PG_LOG_FILE="${BARBERSHOP_PG_LOG:-$PG_DATA_DIR/postgres.log}"

if [[ ! "$PG_PORT" =~ ^[0-9]+$ ]] || (( PG_PORT < 1 || PG_PORT > 65535 )); then
  echo "Erro: porta inválida em BARBERSHOP_PG_PORT: $PG_PORT" >&2
  exit 1
fi

install -d -m 700 "$PG_SOCKET_DIR"

if "$PG_CTL_BIN" -D "$PG_DATA_DIR" status >/dev/null 2>&1; then
  echo "PostgreSQL já está em execução."
else
  echo "Iniciando PostgreSQL na porta $PG_PORT..."
  "$PG_CTL_BIN" \
    -D "$PG_DATA_DIR" \
    -l "$PG_LOG_FILE" \
    -o "-p $PG_PORT -h 127.0.0.1 -k $PG_SOCKET_DIR -c unix_socket_permissions=0700" \
    start
  postgres_started=1
fi

echo "Iniciando backend..."
tsx watch src/server.ts
