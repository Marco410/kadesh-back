-- AlterTable
ALTER TABLE "TechWhatsAppMessage" ADD COLUMN     "internalInitiator" TEXT,
ADD COLUMN     "teamMember" TEXT;

-- CreateIndex
CREATE INDEX "TechWhatsAppMessage_teamMember_idx" ON "TechWhatsAppMessage"("teamMember");

-- CreateIndex
CREATE INDEX "TechWhatsAppMessage_internalInitiator_idx" ON "TechWhatsAppMessage"("internalInitiator");

-- AddForeignKey
ALTER TABLE "TechWhatsAppMessage" ADD CONSTRAINT "TechWhatsAppMessage_teamMember_fkey" FOREIGN KEY ("teamMember") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechWhatsAppMessage" ADD CONSTRAINT "TechWhatsAppMessage_internalInitiator_fkey" FOREIGN KEY ("internalInitiator") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
