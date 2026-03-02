-- CreateTable
CREATE TABLE "TechBusinessLead" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "hasWebsite" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT DEFAULT 'Google Maps',
    "opportunityLevel" TEXT DEFAULT 'Media',
    "pipelineStatus" TEXT DEFAULT '01 - Detectado',
    "estimatedValue" DOUBLE PRECISION,
    "productOffered" TEXT NOT NULL DEFAULT '',
    "assignedSeller" TEXT,
    "firstContactDate" DATE,
    "nextFollowUpDate" DATE,
    "notes" TEXT NOT NULL DEFAULT '',
    "instagram" TEXT NOT NULL DEFAULT '',
    "facebook" TEXT NOT NULL DEFAULT '',
    "xTwitter" TEXT NOT NULL DEFAULT '',
    "tiktok" TEXT NOT NULL DEFAULT '',
    "topReview1" TEXT NOT NULL DEFAULT '',
    "topReview2" TEXT NOT NULL DEFAULT '',
    "topReview3" TEXT NOT NULL DEFAULT '',
    "topReview4" TEXT NOT NULL DEFAULT '',
    "topReview5" TEXT NOT NULL DEFAULT '',
    "websitePromptContent" TEXT NOT NULL DEFAULT '',
    "googleMapsUrl" TEXT NOT NULL DEFAULT '',
    "googlePlaceId" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "TechBusinessLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechSalesActivity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "activityDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT NOT NULL DEFAULT '',
    "comments" TEXT NOT NULL DEFAULT '',
    "businessLead" TEXT,
    "assignedSeller" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechSalesActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechFollowUpTask" (
    "id" TEXT NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "status" TEXT DEFAULT 'Pendiente',
    "priority" TEXT DEFAULT 'Media',
    "businessLead" TEXT,
    "assignedSeller" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "TechFollowUpTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechProposal" (
    "id" TEXT NOT NULL,
    "sentDate" DATE NOT NULL,
    "amount" DOUBLE PRECISION,
    "status" TEXT DEFAULT 'Enviada',
    "fileOrUrl" TEXT NOT NULL DEFAULT '',
    "businessLead" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "TechProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TechBusinessLead_googlePlaceId_key" ON "TechBusinessLead"("googlePlaceId");

-- CreateIndex
CREATE INDEX "TechBusinessLead_businessName_idx" ON "TechBusinessLead"("businessName");

-- CreateIndex
CREATE INDEX "TechBusinessLead_category_idx" ON "TechBusinessLead"("category");

-- CreateIndex
CREATE INDEX "TechBusinessLead_city_idx" ON "TechBusinessLead"("city");

-- CreateIndex
CREATE INDEX "TechBusinessLead_state_idx" ON "TechBusinessLead"("state");

-- CreateIndex
CREATE INDEX "TechBusinessLead_opportunityLevel_idx" ON "TechBusinessLead"("opportunityLevel");

-- CreateIndex
CREATE INDEX "TechBusinessLead_pipelineStatus_idx" ON "TechBusinessLead"("pipelineStatus");

-- CreateIndex
CREATE INDEX "TechBusinessLead_assignedSeller_idx" ON "TechBusinessLead"("assignedSeller");

-- CreateIndex
CREATE INDEX "TechSalesActivity_type_idx" ON "TechSalesActivity"("type");

-- CreateIndex
CREATE INDEX "TechSalesActivity_businessLead_idx" ON "TechSalesActivity"("businessLead");

-- CreateIndex
CREATE INDEX "TechSalesActivity_assignedSeller_idx" ON "TechSalesActivity"("assignedSeller");

-- CreateIndex
CREATE INDEX "TechFollowUpTask_scheduledDate_idx" ON "TechFollowUpTask"("scheduledDate");

-- CreateIndex
CREATE INDEX "TechFollowUpTask_status_idx" ON "TechFollowUpTask"("status");

-- CreateIndex
CREATE INDEX "TechFollowUpTask_businessLead_idx" ON "TechFollowUpTask"("businessLead");

-- CreateIndex
CREATE INDEX "TechFollowUpTask_assignedSeller_idx" ON "TechFollowUpTask"("assignedSeller");

-- CreateIndex
CREATE INDEX "TechProposal_status_idx" ON "TechProposal"("status");

-- CreateIndex
CREATE INDEX "TechProposal_businessLead_idx" ON "TechProposal"("businessLead");

-- AddForeignKey
ALTER TABLE "TechBusinessLead" ADD CONSTRAINT "TechBusinessLead_assignedSeller_fkey" FOREIGN KEY ("assignedSeller") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechSalesActivity" ADD CONSTRAINT "TechSalesActivity_businessLead_fkey" FOREIGN KEY ("businessLead") REFERENCES "TechBusinessLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechSalesActivity" ADD CONSTRAINT "TechSalesActivity_assignedSeller_fkey" FOREIGN KEY ("assignedSeller") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechFollowUpTask" ADD CONSTRAINT "TechFollowUpTask_businessLead_fkey" FOREIGN KEY ("businessLead") REFERENCES "TechBusinessLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechFollowUpTask" ADD CONSTRAINT "TechFollowUpTask_assignedSeller_fkey" FOREIGN KEY ("assignedSeller") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechProposal" ADD CONSTRAINT "TechProposal_businessLead_fkey" FOREIGN KEY ("businessLead") REFERENCES "TechBusinessLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
