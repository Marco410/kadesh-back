-- AlterTable
ALTER TABLE "ActivityEvent" ADD COLUMN     "app" TEXT,
ADD COLUMN     "fingerprint" TEXT,
ADD COLUMN     "page" TEXT;

-- CreateTable
CREATE TABLE "ErrorIssue" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "note" TEXT NOT NULL DEFAULT '',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ErrorIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedIp" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedIp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErrorIssue_fingerprint_key" ON "ErrorIssue"("fingerprint");

-- CreateIndex
CREATE INDEX "ErrorIssue_status_idx" ON "ErrorIssue"("status");

-- CreateIndex
CREATE INDEX "ErrorIssue_resolvedBy_idx" ON "ErrorIssue"("resolvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedIp_ip_key" ON "BlockedIp"("ip");

-- CreateIndex
CREATE INDEX "BlockedIp_createdBy_idx" ON "BlockedIp"("createdBy");

-- CreateIndex
CREATE INDEX "BlockedIp_createdAt_idx" ON "BlockedIp"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_ip_idx" ON "ActivityEvent"("ip");

-- CreateIndex
CREATE INDEX "ActivityEvent_app_idx" ON "ActivityEvent"("app");

-- CreateIndex
CREATE INDEX "ActivityEvent_fingerprint_idx" ON "ActivityEvent"("fingerprint");

-- CreateIndex
CREATE INDEX "UserAuthLog_ip_idx" ON "UserAuthLog"("ip");

-- AddForeignKey
ALTER TABLE "ErrorIssue" ADD CONSTRAINT "ErrorIssue_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedIp" ADD CONSTRAINT "BlockedIp_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
