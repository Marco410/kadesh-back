-- AlterTable
ALTER TABLE "SaasCompany" ADD COLUMN     "aiApiKeyEncrypted" TEXT,
ADD COLUMN     "aiApiKeyPreview" TEXT,
ADD COLUMN     "aiBillingMode" TEXT DEFAULT 'byok',
ADD COLUMN     "aiKeyUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiProvider" TEXT;

-- CreateTable
CREATE TABLE "TechAiCallLog" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "company" TEXT,
    "feature" TEXT,
    "billingMode" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "featurePrompt" TEXT,
    "systemPrompt" TEXT,
    "userPrompt" TEXT,
    "response" TEXT,
    "inputTokens" INTEGER DEFAULT 0,
    "outputTokens" INTEGER DEFAULT 0,
    "billableTokens" INTEGER DEFAULT 0,
    "creditsCharged" INTEGER DEFAULT 0,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechAiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechAiInsight" (
    "id" TEXT NOT NULL,
    "company" TEXT,
    "salesPerson" TEXT,
    "kind" TEXT NOT NULL,
    "referenceKey" TEXT NOT NULL DEFAULT '',
    "content" TEXT,
    "structuredData" JSONB,
    "relatedFile" TEXT,
    "generatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechAiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechAiCallLog_user_idx" ON "TechAiCallLog"("user");

-- CreateIndex
CREATE INDEX "TechAiCallLog_company_idx" ON "TechAiCallLog"("company");

-- CreateIndex
CREATE INDEX "TechAiCallLog_feature_idx" ON "TechAiCallLog"("feature");

-- CreateIndex
CREATE INDEX "TechAiInsight_company_idx" ON "TechAiInsight"("company");

-- CreateIndex
CREATE INDEX "TechAiInsight_salesPerson_idx" ON "TechAiInsight"("salesPerson");

-- CreateIndex
CREATE INDEX "TechAiInsight_kind_idx" ON "TechAiInsight"("kind");

-- CreateIndex
CREATE INDEX "TechAiInsight_referenceKey_idx" ON "TechAiInsight"("referenceKey");

-- CreateIndex
CREATE INDEX "TechAiInsight_relatedFile_idx" ON "TechAiInsight"("relatedFile");

-- AddForeignKey
ALTER TABLE "TechAiCallLog" ADD CONSTRAINT "TechAiCallLog_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechAiCallLog" ADD CONSTRAINT "TechAiCallLog_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechAiInsight" ADD CONSTRAINT "TechAiInsight_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechAiInsight" ADD CONSTRAINT "TechAiInsight_salesPerson_fkey" FOREIGN KEY ("salesPerson") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechAiInsight" ADD CONSTRAINT "TechAiInsight_relatedFile_fkey" FOREIGN KEY ("relatedFile") REFERENCES "TechFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
