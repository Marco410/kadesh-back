-- CreateTable
CREATE TABLE "SaasProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "serviceType" TEXT NOT NULL DEFAULT '',
    "responsible" TEXT,
    "startDate" DATE,
    "estimatedEndDate" DATE,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'Pendiente',
    "company" TEXT,
    "businessLead" TEXT,
    "proposal" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SaasProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaasProject_proposal_key" ON "SaasProject"("proposal");

-- CreateIndex
CREATE INDEX "SaasProject_name_idx" ON "SaasProject"("name");

-- CreateIndex
CREATE INDEX "SaasProject_serviceType_idx" ON "SaasProject"("serviceType");

-- CreateIndex
CREATE INDEX "SaasProject_responsible_idx" ON "SaasProject"("responsible");

-- CreateIndex
CREATE INDEX "SaasProject_status_idx" ON "SaasProject"("status");

-- CreateIndex
CREATE INDEX "SaasProject_company_idx" ON "SaasProject"("company");

-- CreateIndex
CREATE INDEX "SaasProject_businessLead_idx" ON "SaasProject"("businessLead");

-- AddForeignKey
ALTER TABLE "SaasProject" ADD CONSTRAINT "SaasProject_responsible_fkey" FOREIGN KEY ("responsible") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasProject" ADD CONSTRAINT "SaasProject_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasProject" ADD CONSTRAINT "SaasProject_businessLead_fkey" FOREIGN KEY ("businessLead") REFERENCES "TechBusinessLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasProject" ADD CONSTRAINT "SaasProject_proposal_fkey" FOREIGN KEY ("proposal") REFERENCES "TechProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
