-- CreateTable
CREATE TABLE "bloqueios_periodo" (
    "id" TEXT NOT NULL,
    "barbeiroId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueios_periodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bloqueios_periodo_barbeiroId_inicio_idx" ON "bloqueios_periodo"("barbeiroId", "inicio");

-- AddForeignKey
ALTER TABLE "bloqueios_periodo" ADD CONSTRAINT "bloqueios_periodo_barbeiroId_fkey" FOREIGN KEY ("barbeiroId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
