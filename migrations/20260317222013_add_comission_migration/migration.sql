-- AlterTable (idempotent)
ALTER TABLE "SaasPlan" ADD COLUMN IF NOT EXISTS "referralRecurringCommissionPct" DOUBLE PRECISION;
ALTER TABLE "SaasPlan" ADD COLUMN IF NOT EXISTS "referralUpfrontCommissionPct" DOUBLE PRECISION;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "SaasReferralCommission" (
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

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "SaasReferralCommission_referrer_idx" ON "SaasReferralCommission"("referrer");
CREATE INDEX IF NOT EXISTS "SaasReferralCommission_referredUser_idx" ON "SaasReferralCommission"("referredUser");
CREATE INDEX IF NOT EXISTS "SaasReferralCommission_company_idx" ON "SaasReferralCommission"("company");
CREATE INDEX IF NOT EXISTS "SaasReferralCommission_subscription_idx" ON "SaasReferralCommission"("subscription");
CREATE INDEX IF NOT EXISTS "SaasReferralCommission_plan_idx" ON "SaasReferralCommission"("plan");

-- AddForeignKey (idempotent: only add if constraint does not exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasReferralCommission_referrer_fkey') THEN
    ALTER TABLE "SaasReferralCommission" ADD CONSTRAINT "SaasReferralCommission_referrer_fkey" FOREIGN KEY ("referrer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasReferralCommission_referredUser_fkey') THEN
    ALTER TABLE "SaasReferralCommission" ADD CONSTRAINT "SaasReferralCommission_referredUser_fkey" FOREIGN KEY ("referredUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasReferralCommission_company_fkey') THEN
    ALTER TABLE "SaasReferralCommission" ADD CONSTRAINT "SaasReferralCommission_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasReferralCommission_subscription_fkey') THEN
    ALTER TABLE "SaasReferralCommission" ADD CONSTRAINT "SaasReferralCommission_subscription_fkey" FOREIGN KEY ("subscription") REFERENCES "SaasCompanySubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasReferralCommission_plan_fkey') THEN
    ALTER TABLE "SaasReferralCommission" ADD CONSTRAINT "SaasReferralCommission_plan_fkey" FOREIGN KEY ("plan") REFERENCES "SaasPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
