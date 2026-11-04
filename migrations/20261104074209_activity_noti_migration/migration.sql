-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "pushDevices" INTEGER,
ADD COLUMN     "pushStatus" TEXT,
ADD COLUMN     "whatsappDetail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "whatsappMessageId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "whatsappStatus" TEXT,
ADD COLUMN     "whatsappUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notification_whatsappMessageId_idx" ON "Notification"("whatsappMessageId");
