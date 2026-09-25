-- AlterTable
ALTER TABLE "PetPlace" ADD COLUMN     "pipelineStatus" TEXT DEFAULT '01 - Detectado';

-- CreateIndex
CREATE INDEX "PetPlace_pipelineStatus_idx" ON "PetPlace"("pipelineStatus");
