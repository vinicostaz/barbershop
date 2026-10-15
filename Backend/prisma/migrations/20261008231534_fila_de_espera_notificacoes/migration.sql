/*
  Warnings:

  - You are about to drop the column `dataDesejada` on the `fila_de_espera` table. All the data in the column will be lost.
  - Added the required column `horaFim` to the `fila_de_espera` table without a default value. This is not possible if the table is not empty.
  - Added the required column `horaInicio` to the `fila_de_espera` table without a default value. This is not possible if the table is not empty.
  - Added the required column `servicoId` to the `fila_de_espera` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('HORARIO_LIBERADO', 'PRIORIDADE_EXPIRADA');

-- AlterTable
ALTER TABLE "fila_de_espera" DROP COLUMN "dataDesejada",
ADD COLUMN     "expiraEm" TIMESTAMP(3),
ADD COLUMN     "horaFim" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "horaInicio" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "servicoId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "filaDeEsperaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificacoes_usuarioId_lida_idx" ON "notificacoes"("usuarioId", "lida");

-- CreateIndex
CREATE INDEX "fila_de_espera_barbeiroId_horaInicio_status_idx" ON "fila_de_espera"("barbeiroId", "horaInicio", "status");

-- AddForeignKey
ALTER TABLE "fila_de_espera" ADD CONSTRAINT "fila_de_espera_barbeiroId_fkey" FOREIGN KEY ("barbeiroId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_de_espera" ADD CONSTRAINT "fila_de_espera_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_filaDeEsperaId_fkey" FOREIGN KEY ("filaDeEsperaId") REFERENCES "fila_de_espera"("id") ON DELETE SET NULL ON UPDATE CASCADE;
