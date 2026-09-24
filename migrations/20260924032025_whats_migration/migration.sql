-- AlterTable
ALTER TABLE "SaasCompany" ADD COLUMN     "whatsappAppId" TEXT,
ADD COLUMN     "whatsappLastWebhookAt" TIMESTAMP(3),
ADD COLUMN     "whatsappWebhookConfiguredAt" TIMESTAMP(3);
