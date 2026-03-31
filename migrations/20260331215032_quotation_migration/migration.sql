-- AlterTable
ALTER TABLE "SaasCompany" ADD COLUMN     "colorPrimary" TEXT DEFAULT '#F7945E',
ADD COLUMN     "colorSecondary" TEXT DEFAULT '#E07C3A',
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "logo_filename" TEXT,
ADD COLUMN     "logo_filesize" INTEGER,
ADD COLUMN     "onboardingAvgTicketValue" TEXT,
ADD COLUMN     "onboardingIdealCustomer" TEXT,
ADD COLUMN     "onboardingMainOffer" TEXT,
ADD COLUMN     "onboardingSalesPain" TEXT,
ADD COLUMN     "termsQuotation" TEXT;

-- CreateTable
CREATE TABLE "SaasQuotation" (
    "id" TEXT NOT NULL,
    "company" TEXT,
    "lead" TEXT,
    "project" TEXT,
    "quotationNumber" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "exchangeRate" DOUBLE PRECISION DEFAULT 1,
    "subtotal" DOUBLE PRECISION DEFAULT 0,
    "discountTotal" DOUBLE PRECISION DEFAULT 0,
    "taxTotal" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION DEFAULT 0,
    "validUntil" DATE,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "notes" TEXT,
    "terms" TEXT,
    "createdBy" TEXT,
    "assignedSeller" TEXT,
    "pdfFileOrUrl" TEXT,
    "showDiscount" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SaasQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasQuotationProduct" (
    "id" TEXT NOT NULL,
    "quotation" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" DOUBLE PRECISION DEFAULT 1,
    "unitPrice" DOUBLE PRECISION DEFAULT 0,
    "discountType" TEXT DEFAULT 'none',
    "discountValue" DOUBLE PRECISION DEFAULT 0,
    "taxRate" DOUBLE PRECISION DEFAULT 0,
    "lineSubtotal" DOUBLE PRECISION DEFAULT 0,
    "lineTotal" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SaasQuotationProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaasQuotation_company_idx" ON "SaasQuotation"("company");

-- CreateIndex
CREATE INDEX "SaasQuotation_lead_idx" ON "SaasQuotation"("lead");

-- CreateIndex
CREATE INDEX "SaasQuotation_project_idx" ON "SaasQuotation"("project");

-- CreateIndex
CREATE INDEX "SaasQuotation_quotationNumber_idx" ON "SaasQuotation"("quotationNumber");

-- CreateIndex
CREATE INDEX "SaasQuotation_status_idx" ON "SaasQuotation"("status");

-- CreateIndex
CREATE INDEX "SaasQuotation_createdBy_idx" ON "SaasQuotation"("createdBy");

-- CreateIndex
CREATE INDEX "SaasQuotation_assignedSeller_idx" ON "SaasQuotation"("assignedSeller");

-- CreateIndex
CREATE INDEX "SaasQuotationProduct_quotation_idx" ON "SaasQuotationProduct"("quotation");

-- AddForeignKey
ALTER TABLE "SaasQuotation" ADD CONSTRAINT "SaasQuotation_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasQuotation" ADD CONSTRAINT "SaasQuotation_lead_fkey" FOREIGN KEY ("lead") REFERENCES "TechBusinessLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasQuotation" ADD CONSTRAINT "SaasQuotation_project_fkey" FOREIGN KEY ("project") REFERENCES "SaasProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasQuotation" ADD CONSTRAINT "SaasQuotation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasQuotation" ADD CONSTRAINT "SaasQuotation_assignedSeller_fkey" FOREIGN KEY ("assignedSeller") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasQuotationProduct" ADD CONSTRAINT "SaasQuotationProduct_quotation_fkey" FOREIGN KEY ("quotation") REFERENCES "SaasQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
