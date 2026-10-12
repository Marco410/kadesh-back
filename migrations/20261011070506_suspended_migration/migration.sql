-- AlterTable
ALTER TABLE "SaasCompany" ADD COLUMN     "accountManager" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "sessionVersion" INTEGER DEFAULT 0,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;

-- CreateTable
CREATE TABLE "SaasCompanyDailyUsage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "company" TEXT,
    "day" DATE NOT NULL,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "activeMinutes" INTEGER NOT NULL DEFAULT 0,
    "logins" INTEGER NOT NULL DEFAULT 0,
    "extractions" INTEGER NOT NULL DEFAULT 0,
    "extractionsFailed" INTEGER NOT NULL DEFAULT 0,
    "leadsCreated" INTEGER NOT NULL DEFAULT 0,
    "leadsReused" INTEGER NOT NULL DEFAULT 0,
    "creditsConsumed" INTEGER NOT NULL DEFAULT 0,
    "aiCalls" INTEGER NOT NULL DEFAULT 0,
    "crmChanges" INTEGER NOT NULL DEFAULT 0,
    "activitiesLogged" INTEGER NOT NULL DEFAULT 0,
    "quotationsCreated" INTEGER NOT NULL DEFAULT 0,
    "quotationsSent" INTEGER NOT NULL DEFAULT 0,
    "quotationsAccepted" INTEGER NOT NULL DEFAULT 0,
    "whatsappSent" INTEGER NOT NULL DEFAULT 0,
    "whatsappReceived" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3),

    CONSTRAINT "SaasCompanyDailyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasCompanyNote" (
    "id" TEXT NOT NULL,
    "company" TEXT,
    "author" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SaasCompanyNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaasCompanyDailyUsage_key_key" ON "SaasCompanyDailyUsage"("key");

-- CreateIndex
CREATE INDEX "SaasCompanyDailyUsage_company_idx" ON "SaasCompanyDailyUsage"("company");

-- CreateIndex
CREATE INDEX "SaasCompanyDailyUsage_day_idx" ON "SaasCompanyDailyUsage"("day");

-- CreateIndex
CREATE INDEX "SaasCompanyNote_company_idx" ON "SaasCompanyNote"("company");

-- CreateIndex
CREATE INDEX "SaasCompanyNote_author_idx" ON "SaasCompanyNote"("author");

-- CreateIndex
CREATE INDEX "SaasCompanyNote_createdAt_idx" ON "SaasCompanyNote"("createdAt");

-- CreateIndex
CREATE INDEX "SaasCompany_accountManager_idx" ON "SaasCompany"("accountManager");

-- AddForeignKey
ALTER TABLE "SaasCompany" ADD CONSTRAINT "SaasCompany_accountManager_fkey" FOREIGN KEY ("accountManager") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasCompanyDailyUsage" ADD CONSTRAINT "SaasCompanyDailyUsage_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasCompanyNote" ADD CONSTRAINT "SaasCompanyNote_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasCompanyNote" ADD CONSTRAINT "SaasCompanyNote_author_fkey" FOREIGN KEY ("author") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
