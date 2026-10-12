-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signupAttribution" JSONB;

-- CreateTable
CREATE TABLE "TechLeadStageChange" (
    "id" TEXT NOT NULL,
    "company" TEXT,
    "businessLead" TEXT,
    "statusId" TEXT NOT NULL DEFAULT '',
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT,
    "source" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechLeadStageChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechLeadStageChange_company_idx" ON "TechLeadStageChange"("company");

-- CreateIndex
CREATE INDEX "TechLeadStageChange_businessLead_idx" ON "TechLeadStageChange"("businessLead");

-- CreateIndex
CREATE INDEX "TechLeadStageChange_statusId_idx" ON "TechLeadStageChange"("statusId");

-- CreateIndex
CREATE INDEX "TechLeadStageChange_toStatus_idx" ON "TechLeadStageChange"("toStatus");

-- CreateIndex
CREATE INDEX "TechLeadStageChange_changedBy_idx" ON "TechLeadStageChange"("changedBy");

-- CreateIndex
CREATE INDEX "TechLeadStageChange_changedAt_idx" ON "TechLeadStageChange"("changedAt");

-- AddForeignKey
ALTER TABLE "TechLeadStageChange" ADD CONSTRAINT "TechLeadStageChange_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechLeadStageChange" ADD CONSTRAINT "TechLeadStageChange_businessLead_fkey" FOREIGN KEY ("businessLead") REFERENCES "TechBusinessLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechLeadStageChange" ADD CONSTRAINT "TechLeadStageChange_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
