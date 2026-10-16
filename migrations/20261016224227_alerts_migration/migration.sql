-- AlterTable
ALTER TABLE "TokenNotification" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "platform" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alertLat" DOUBLE PRECISION,
ADD COLUMN     "alertLng" DOUBLE PRECISION,
ADD COLUMN     "alertRadiusKm" INTEGER DEFAULT 5,
ADD COLUMN     "petAlertsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "TokenNotification_token_idx" ON "TokenNotification"("token");
