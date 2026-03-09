/*
  Warnings:

  - You are about to drop the column `estimatedValue` on the `TechBusinessLead` table. All the data in the column will be lost.
  - You are about to drop the column `firstContactDate` on the `TechBusinessLead` table. All the data in the column will be lost.
  - You are about to drop the column `nextFollowUpDate` on the `TechBusinessLead` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `TechBusinessLead` table. All the data in the column will be lost.
  - You are about to drop the column `opportunityLevel` on the `TechBusinessLead` table. All the data in the column will be lost.
  - You are about to drop the column `pipelineStatus` on the `TechBusinessLead` table. All the data in the column will be lost.
  - You are about to drop the column `productOffered` on the `TechBusinessLead` table. All the data in the column will be lost.
  - You are about to drop the column `salesPerson` on the `TechBusinessLead` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "TechBusinessLead" DROP CONSTRAINT "TechBusinessLead_salesPerson_fkey";

-- DropIndex
DROP INDEX "TechBusinessLead_opportunityLevel_idx";

-- DropIndex
DROP INDEX "TechBusinessLead_pipelineStatus_idx";

-- DropIndex
DROP INDEX "TechBusinessLead_salesPerson_idx";

-- AlterTable
ALTER TABLE "TechBusinessLead" DROP COLUMN "estimatedValue",
DROP COLUMN "firstContactDate",
DROP COLUMN "nextFollowUpDate",
DROP COLUMN "notes",
DROP COLUMN "opportunityLevel",
DROP COLUMN "pipelineStatus",
DROP COLUMN "productOffered",
DROP COLUMN "salesPerson",
ADD COLUMN     "country" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "websiteUrl" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "TechProposal" ADD COLUMN     "assignedSeller" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "company" TEXT,
ADD COLUMN     "salesComission" INTEGER DEFAULT 10,
ADD COLUMN     "salesPersonVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateTable
CREATE TABLE "SaasCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "allowedGooglePlaceCategories" JSONB,
    "plan" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SaasCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasCompanyMonthlyLeadSync" (
    "id" TEXT NOT NULL,
    "company" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "syncedCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SaasCompanyMonthlyLeadSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasCompanySubscription" (
    "id" TEXT NOT NULL,
    "company" TEXT,
    "planName" TEXT NOT NULL DEFAULT '',
    "planCost" DOUBLE PRECISION,
    "planFrequency" TEXT NOT NULL DEFAULT '',
    "planLeadLimit" INTEGER,
    "planStripePriceId" TEXT NOT NULL DEFAULT '',
    "planCurrency" TEXT NOT NULL DEFAULT '',
    "planFeatures" JSONB,
    "status" TEXT DEFAULT 'active',
    "activatedAt" DATE,
    "currentPeriodEnd" DATE,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "plan" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SaasCompanySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasPayment" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "paymentMethodType" TEXT,
    "paymentMethod" TEXT,
    "amount" DECIMAL(18,6) DEFAULT 0,
    "status" TEXT DEFAULT 'pending',
    "processorStripeChargeId" TEXT NOT NULL DEFAULT '',
    "stripeErrorMessage" TEXT,
    "notes" TEXT,
    "plan" TEXT,
    "subscription" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SaasPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasPaymentMethod" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "cardType" TEXT NOT NULL DEFAULT '',
    "lastFourDigits" TEXT NOT NULL DEFAULT '',
    "expMonth" TEXT NOT NULL DEFAULT '',
    "expYear" TEXT NOT NULL DEFAULT '',
    "stripeProcessorId" TEXT NOT NULL DEFAULT '',
    "stripePaymentMethodId" TEXT NOT NULL DEFAULT '',
    "address" TEXT,
    "postalCode" TEXT,
    "ownerName" TEXT NOT NULL DEFAULT '',
    "country" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SaasPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "cost" DOUBLE PRECISION,
    "frequency" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'mxn',
    "leadLimit" INTEGER,
    "planFeatures" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "bestSeller" BOOLEAN NOT NULL DEFAULT false,
    "stripePriceId" TEXT,
    "stripeProductId" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SaasPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechStatusBusinessLead" (
    "id" TEXT NOT NULL,
    "businessLead" TEXT,
    "opportunityLevel" TEXT DEFAULT 'Media',
    "pipelineStatus" TEXT DEFAULT '01 - Detectado',
    "estimatedValue" DOUBLE PRECISION,
    "productOffered" TEXT NOT NULL DEFAULT '',
    "firstContactDate" DATE,
    "saasCompany" TEXT,
    "salesPerson" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "TechStatusBusinessLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SaasCompany_leads" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_TechBusinessLead_salesPerson" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "SaasCompany_name_idx" ON "SaasCompany"("name");

-- CreateIndex
CREATE INDEX "SaasCompany_plan_idx" ON "SaasCompany"("plan");

-- CreateIndex
CREATE INDEX "SaasCompanyMonthlyLeadSync_company_idx" ON "SaasCompanyMonthlyLeadSync"("company");

-- CreateIndex
CREATE INDEX "SaasCompanyMonthlyLeadSync_year_idx" ON "SaasCompanyMonthlyLeadSync"("year");

-- CreateIndex
CREATE INDEX "SaasCompanyMonthlyLeadSync_month_idx" ON "SaasCompanyMonthlyLeadSync"("month");

-- CreateIndex
CREATE INDEX "SaasCompanySubscription_company_idx" ON "SaasCompanySubscription"("company");

-- CreateIndex
CREATE INDEX "SaasCompanySubscription_plan_idx" ON "SaasCompanySubscription"("plan");

-- CreateIndex
CREATE INDEX "SaasPayment_user_idx" ON "SaasPayment"("user");

-- CreateIndex
CREATE INDEX "SaasPayment_paymentMethod_idx" ON "SaasPayment"("paymentMethod");

-- CreateIndex
CREATE INDEX "SaasPayment_plan_idx" ON "SaasPayment"("plan");

-- CreateIndex
CREATE INDEX "SaasPayment_subscription_idx" ON "SaasPayment"("subscription");

-- CreateIndex
CREATE UNIQUE INDEX "SaasPaymentMethod_stripePaymentMethodId_key" ON "SaasPaymentMethod"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "SaasPaymentMethod_user_idx" ON "SaasPaymentMethod"("user");

-- CreateIndex
CREATE UNIQUE INDEX "SaasPlan_stripePriceId_key" ON "SaasPlan"("stripePriceId");

-- CreateIndex
CREATE INDEX "SaasPlan_name_idx" ON "SaasPlan"("name");

-- CreateIndex
CREATE INDEX "TechStatusBusinessLead_businessLead_idx" ON "TechStatusBusinessLead"("businessLead");

-- CreateIndex
CREATE INDEX "TechStatusBusinessLead_opportunityLevel_idx" ON "TechStatusBusinessLead"("opportunityLevel");

-- CreateIndex
CREATE INDEX "TechStatusBusinessLead_pipelineStatus_idx" ON "TechStatusBusinessLead"("pipelineStatus");

-- CreateIndex
CREATE INDEX "TechStatusBusinessLead_saasCompany_idx" ON "TechStatusBusinessLead"("saasCompany");

-- CreateIndex
CREATE INDEX "TechStatusBusinessLead_salesPerson_idx" ON "TechStatusBusinessLead"("salesPerson");

-- CreateIndex
CREATE UNIQUE INDEX "_SaasCompany_leads_AB_unique" ON "_SaasCompany_leads"("A", "B");

-- CreateIndex
CREATE INDEX "_SaasCompany_leads_B_index" ON "_SaasCompany_leads"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_TechBusinessLead_salesPerson_AB_unique" ON "_TechBusinessLead_salesPerson"("A", "B");

-- CreateIndex
CREATE INDEX "_TechBusinessLead_salesPerson_B_index" ON "_TechBusinessLead_salesPerson"("B");

-- CreateIndex
CREATE INDEX "TechBusinessLead_country_idx" ON "TechBusinessLead"("country");

-- CreateIndex
CREATE INDEX "TechProposal_assignedSeller_idx" ON "TechProposal"("assignedSeller");

-- CreateIndex
CREATE INDEX "User_company_idx" ON "User"("company");

-- AddForeignKey
ALTER TABLE "SaasCompany" ADD CONSTRAINT "SaasCompany_plan_fkey" FOREIGN KEY ("plan") REFERENCES "SaasPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasCompanyMonthlyLeadSync" ADD CONSTRAINT "SaasCompanyMonthlyLeadSync_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasCompanySubscription" ADD CONSTRAINT "SaasCompanySubscription_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasCompanySubscription" ADD CONSTRAINT "SaasCompanySubscription_plan_fkey" FOREIGN KEY ("plan") REFERENCES "SaasPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasPayment" ADD CONSTRAINT "SaasPayment_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasPayment" ADD CONSTRAINT "SaasPayment_paymentMethod_fkey" FOREIGN KEY ("paymentMethod") REFERENCES "SaasPaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasPayment" ADD CONSTRAINT "SaasPayment_plan_fkey" FOREIGN KEY ("plan") REFERENCES "SaasPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasPayment" ADD CONSTRAINT "SaasPayment_subscription_fkey" FOREIGN KEY ("subscription") REFERENCES "SaasCompanySubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasPaymentMethod" ADD CONSTRAINT "SaasPaymentMethod_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechProposal" ADD CONSTRAINT "TechProposal_assignedSeller_fkey" FOREIGN KEY ("assignedSeller") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechStatusBusinessLead" ADD CONSTRAINT "TechStatusBusinessLead_businessLead_fkey" FOREIGN KEY ("businessLead") REFERENCES "TechBusinessLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechStatusBusinessLead" ADD CONSTRAINT "TechStatusBusinessLead_saasCompany_fkey" FOREIGN KEY ("saasCompany") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechStatusBusinessLead" ADD CONSTRAINT "TechStatusBusinessLead_salesPerson_fkey" FOREIGN KEY ("salesPerson") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SaasCompany_leads" ADD CONSTRAINT "_SaasCompany_leads_A_fkey" FOREIGN KEY ("A") REFERENCES "SaasCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SaasCompany_leads" ADD CONSTRAINT "_SaasCompany_leads_B_fkey" FOREIGN KEY ("B") REFERENCES "TechBusinessLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TechBusinessLead_salesPerson" ADD CONSTRAINT "_TechBusinessLead_salesPerson_A_fkey" FOREIGN KEY ("A") REFERENCES "TechBusinessLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TechBusinessLead_salesPerson" ADD CONSTRAINT "_TechBusinessLead_salesPerson_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
