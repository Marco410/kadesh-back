-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "facebookPostId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "facebookPublishedAt" TIMESTAMP(3),
ADD COLUMN     "facebookPublishedBy" TEXT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipient" TEXT,
    "product" TEXT DEFAULT 'saas',
    "type" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "entityType" TEXT NOT NULL DEFAULT '',
    "entityId" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_recipient_idx" ON "Notification"("recipient");

-- CreateIndex
CREATE INDEX "Notification_product_idx" ON "Notification"("product");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Animal_facebookPublishedBy_idx" ON "Animal"("facebookPublishedBy");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipient_fkey" FOREIGN KEY ("recipient") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_facebookPublishedBy_fkey" FOREIGN KEY ("facebookPublishedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
