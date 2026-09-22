/*
  Warnings:

  - A unique constraint covering the columns `[whatsappPhoneNumberId]` on the table `SaasCompany` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SaasCompany" ADD COLUMN     "whatsappAccessTokenEncrypted" TEXT,
ADD COLUMN     "whatsappAppSecretEncrypted" TEXT,
ADD COLUMN     "whatsappBusinessAccountId" TEXT,
ADD COLUMN     "whatsappConnectedAt" TIMESTAMP(3),
ADD COLUMN     "whatsappDisplayPhoneNumber" TEXT,
ADD COLUMN     "whatsappPhoneNumberId" TEXT,
ADD COLUMN     "whatsappTokenPreview" TEXT;

-- CreateTable
CREATE TABLE "TechWhatsAppMessage" (
    "id" TEXT NOT NULL,
    "company" TEXT,
    "businessLead" TEXT,
    "direction" TEXT NOT NULL,
    "source" TEXT DEFAULT 'api',
    "senderLabel" TEXT,
    "waMessageId" TEXT,
    "fromPhone" TEXT,
    "toPhone" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'sent',
    "sentBy" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechWhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TechWhatsAppMessage_waMessageId_key" ON "TechWhatsAppMessage"("waMessageId");

-- CreateIndex
CREATE INDEX "TechWhatsAppMessage_company_idx" ON "TechWhatsAppMessage"("company");

-- CreateIndex
CREATE INDEX "TechWhatsAppMessage_businessLead_idx" ON "TechWhatsAppMessage"("businessLead");

-- CreateIndex
CREATE INDEX "TechWhatsAppMessage_direction_idx" ON "TechWhatsAppMessage"("direction");

-- CreateIndex
CREATE INDEX "TechWhatsAppMessage_source_idx" ON "TechWhatsAppMessage"("source");

-- CreateIndex
CREATE INDEX "TechWhatsAppMessage_sentBy_idx" ON "TechWhatsAppMessage"("sentBy");

-- CreateIndex
CREATE UNIQUE INDEX "SaasCompany_whatsappPhoneNumberId_key" ON "SaasCompany"("whatsappPhoneNumberId");

-- AddForeignKey
ALTER TABLE "TechWhatsAppMessage" ADD CONSTRAINT "TechWhatsAppMessage_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechWhatsAppMessage" ADD CONSTRAINT "TechWhatsAppMessage_businessLead_fkey" FOREIGN KEY ("businessLead") REFERENCES "TechBusinessLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechWhatsAppMessage" ADD CONSTRAINT "TechWhatsAppMessage_sentBy_fkey" FOREIGN KEY ("sentBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
