/*
  Warnings:

  - A unique constraint covering the columns `[whatsappBusinessAccountId]` on the table `SaasCompany` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SaasCompany" ADD COLUMN     "whatsappTemplateLanguage" TEXT,
ADD COLUMN     "whatsappTemplateName" TEXT,
ADD COLUMN     "whatsappTemplateStatus" TEXT DEFAULT 'none';

-- AlterTable
ALTER TABLE "TechWhatsAppMessage" ADD COLUMN     "mediaFileName" TEXT,
ADD COLUMN     "mediaKey" TEXT,
ADD COLUMN     "mediaType" TEXT,
ADD COLUMN     "messageKind" TEXT DEFAULT 'text';

-- CreateIndex
CREATE UNIQUE INDEX "SaasCompany_whatsappBusinessAccountId_key" ON "SaasCompany"("whatsappBusinessAccountId");
