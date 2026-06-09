-- AlterTable
ALTER TABLE "SaasCompany" ADD COLUMN     "purchasedBonusCredits" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "SaasCompanySubscription" ADD COLUMN     "newCreditsAdded" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "SaasCompanyCreditPeriod" (
    "id" TEXT NOT NULL,
    "company" TEXT,
    "subscription" TEXT,
    "periodKey" TEXT NOT NULL DEFAULT '',
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "planAllowance" INTEGER DEFAULT 0,
    "bonusAllowance" INTEGER DEFAULT 0,
    "used" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SaasCompanyCreditPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasCompanyCreditLedger" (
    "id" TEXT NOT NULL,
    "company" TEXT,
    "period" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaasCompanyCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaasCompanyCreditPeriod_periodKey_key" ON "SaasCompanyCreditPeriod"("periodKey");

-- CreateIndex
CREATE INDEX "SaasCompanyCreditPeriod_company_idx" ON "SaasCompanyCreditPeriod"("company");

-- CreateIndex
CREATE INDEX "SaasCompanyCreditPeriod_subscription_idx" ON "SaasCompanyCreditPeriod"("subscription");

-- CreateIndex
CREATE INDEX "SaasCompanyCreditPeriod_year_idx" ON "SaasCompanyCreditPeriod"("year");

-- CreateIndex
CREATE INDEX "SaasCompanyCreditPeriod_month_idx" ON "SaasCompanyCreditPeriod"("month");

-- CreateIndex
CREATE INDEX "SaasCompanyCreditLedger_company_idx" ON "SaasCompanyCreditLedger"("company");

-- CreateIndex
CREATE INDEX "SaasCompanyCreditLedger_period_idx" ON "SaasCompanyCreditLedger"("period");

-- AddForeignKey
ALTER TABLE "SaasCompanyCreditPeriod" ADD CONSTRAINT "SaasCompanyCreditPeriod_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasCompanyCreditPeriod" ADD CONSTRAINT "SaasCompanyCreditPeriod_subscription_fkey" FOREIGN KEY ("subscription") REFERENCES "SaasCompanySubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasCompanyCreditLedger" ADD CONSTRAINT "SaasCompanyCreditLedger_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasCompanyCreditLedger" ADD CONSTRAINT "SaasCompanyCreditLedger_period_fkey" FOREIGN KEY ("period") REFERENCES "SaasCompanyCreditPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
