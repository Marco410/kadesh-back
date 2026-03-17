-- AlterTable
ALTER TABLE "SaasPlan" ADD COLUMN     "referralRecurringCommissionPct" DOUBLE PRECISION,
ADD COLUMN     "referralUpfrontCommissionPct" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "SaasReferralCommission" (
    "id" TEXT NOT NULL,
    "referrer" TEXT,
    "referredUser" TEXT,
    "company" TEXT,
    "subscription" TEXT,
    "plan" TEXT,
    "type" TEXT,
    "percentage" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'mxn',
    "periodIndex" DOUBLE PRECISION,
    "periodStart" DATE,
    "periodEnd" DATE,
    "status" TEXT DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SaasReferralCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaasReferralCommission_referrer_idx" ON "SaasReferralCommission"("referrer");

-- CreateIndex
CREATE INDEX "SaasReferralCommission_referredUser_idx" ON "SaasReferralCommission"("referredUser");

-- CreateIndex
CREATE INDEX "SaasReferralCommission_company_idx" ON "SaasReferralCommission"("company");

-- CreateIndex
CREATE INDEX "SaasReferralCommission_subscription_idx" ON "SaasReferralCommission"("subscription");

-- CreateIndex
CREATE INDEX "SaasReferralCommission_plan_idx" ON "SaasReferralCommission"("plan");

-- AddForeignKey
ALTER TABLE "SaasReferralCommission" ADD CONSTRAINT "SaasReferralCommission_referrer_fkey" FOREIGN KEY ("referrer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasReferralCommission" ADD CONSTRAINT "SaasReferralCommission_referredUser_fkey" FOREIGN KEY ("referredUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasReferralCommission" ADD CONSTRAINT "SaasReferralCommission_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasReferralCommission" ADD CONSTRAINT "SaasReferralCommission_subscription_fkey" FOREIGN KEY ("subscription") REFERENCES "SaasCompanySubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasReferralCommission" ADD CONSTRAINT "SaasReferralCommission_plan_fkey" FOREIGN KEY ("plan") REFERENCES "SaasPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
