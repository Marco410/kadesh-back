-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "followUpSentAt" TIMESTAMP(3),
ADD COLUMN     "followUpStage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "inactiveAt" TIMESTAMP(3),
ADD COLUMN     "lastActivityAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Animal_lastActivityAt_idx" ON "Animal"("lastActivityAt");

-- CreateIndex
CREATE INDEX "Animal_inactiveAt_idx" ON "Animal"("inactiveAt");
