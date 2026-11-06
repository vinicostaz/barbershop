-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacao" ADD VALUE 'AGENDAMENTO_CANCELADO';
ALTER TYPE "TipoNotificacao" ADD VALUE 'ATENDIMENTO_CONCLUIDO';

-- AlterTable
ALTER TABLE "notificacoes" ADD COLUMN     "agendamentoId" TEXT;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
