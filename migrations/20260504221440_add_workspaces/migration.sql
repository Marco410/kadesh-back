-- AlterTable
ALTER TABLE "TechFollowUpTask" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "hiddenInWorkspace" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statusCrm" TEXT,
ADD COLUMN     "workspace" TEXT;

-- AlterTable
ALTER TABLE "TechProposal" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "hiddenInWorkspace" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statusCrm" TEXT,
ADD COLUMN     "workspace" TEXT;

-- AlterTable
ALTER TABLE "TechSalesActivity" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "dueDate" DATE,
ADD COLUMN     "hiddenInWorkspace" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" TEXT DEFAULT 'Media',
ADD COLUMN     "statusCrm" TEXT,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "workspace" TEXT;

-- CreateTable
CREATE TABLE "SaasWorkspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "showActivities" BOOLEAN NOT NULL DEFAULT true,
    "showProposals" BOOLEAN NOT NULL DEFAULT true,
    "showFollowUpTasks" BOOLEAN NOT NULL DEFAULT true,
    "showTasks" BOOLEAN NOT NULL DEFAULT true,
    "company" TEXT,

    CONSTRAINT "SaasWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasWorkspaceCrmStatus" (
    "id" TEXT NOT NULL,
    "workspace" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL DEFAULT '',
    "order" INTEGER DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SaasWorkspaceCrmStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "priority" TEXT DEFAULT 'Media',
    "result" TEXT NOT NULL DEFAULT '',
    "comments" TEXT NOT NULL DEFAULT '',
    "businessLead" TEXT,
    "responsible" TEXT,
    "workspace" TEXT,
    "statusCrm" TEXT,
    "createdBy" TEXT,
    "hiddenInWorkspace" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SaasWorkspace_members" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "SaasWorkspace_name_idx" ON "SaasWorkspace"("name");

-- CreateIndex
CREATE INDEX "SaasWorkspace_company_idx" ON "SaasWorkspace"("company");

-- CreateIndex
CREATE INDEX "SaasWorkspaceCrmStatus_workspace_idx" ON "SaasWorkspaceCrmStatus"("workspace");

-- CreateIndex
CREATE INDEX "SaasWorkspaceCrmStatus_name_idx" ON "SaasWorkspaceCrmStatus"("name");

-- CreateIndex
CREATE INDEX "SaasWorkspaceCrmStatus_key_idx" ON "SaasWorkspaceCrmStatus"("key");

-- CreateIndex
CREATE INDEX "SaasWorkspaceCrmStatus_order_idx" ON "SaasWorkspaceCrmStatus"("order");

-- CreateIndex
CREATE INDEX "TechTask_dueDate_idx" ON "TechTask"("dueDate");

-- CreateIndex
CREATE INDEX "TechTask_businessLead_idx" ON "TechTask"("businessLead");

-- CreateIndex
CREATE INDEX "TechTask_responsible_idx" ON "TechTask"("responsible");

-- CreateIndex
CREATE INDEX "TechTask_workspace_idx" ON "TechTask"("workspace");

-- CreateIndex
CREATE INDEX "TechTask_statusCrm_idx" ON "TechTask"("statusCrm");

-- CreateIndex
CREATE INDEX "TechTask_createdBy_idx" ON "TechTask"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "_SaasWorkspace_members_AB_unique" ON "_SaasWorkspace_members"("A", "B");

-- CreateIndex
CREATE INDEX "_SaasWorkspace_members_B_index" ON "_SaasWorkspace_members"("B");

-- CreateIndex
CREATE INDEX "TechFollowUpTask_createdBy_idx" ON "TechFollowUpTask"("createdBy");

-- CreateIndex
CREATE INDEX "TechFollowUpTask_workspace_idx" ON "TechFollowUpTask"("workspace");

-- CreateIndex
CREATE INDEX "TechFollowUpTask_statusCrm_idx" ON "TechFollowUpTask"("statusCrm");

-- CreateIndex
CREATE INDEX "TechProposal_createdBy_idx" ON "TechProposal"("createdBy");

-- CreateIndex
CREATE INDEX "TechProposal_workspace_idx" ON "TechProposal"("workspace");

-- CreateIndex
CREATE INDEX "TechProposal_statusCrm_idx" ON "TechProposal"("statusCrm");

-- CreateIndex
CREATE INDEX "TechSalesActivity_dueDate_idx" ON "TechSalesActivity"("dueDate");

-- CreateIndex
CREATE INDEX "TechSalesActivity_createdBy_idx" ON "TechSalesActivity"("createdBy");

-- CreateIndex
CREATE INDEX "TechSalesActivity_workspace_idx" ON "TechSalesActivity"("workspace");

-- CreateIndex
CREATE INDEX "TechSalesActivity_statusCrm_idx" ON "TechSalesActivity"("statusCrm");

-- AddForeignKey
ALTER TABLE "SaasWorkspace" ADD CONSTRAINT "SaasWorkspace_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasWorkspaceCrmStatus" ADD CONSTRAINT "SaasWorkspaceCrmStatus_workspace_fkey" FOREIGN KEY ("workspace") REFERENCES "SaasWorkspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechFollowUpTask" ADD CONSTRAINT "TechFollowUpTask_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechFollowUpTask" ADD CONSTRAINT "TechFollowUpTask_workspace_fkey" FOREIGN KEY ("workspace") REFERENCES "SaasWorkspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechFollowUpTask" ADD CONSTRAINT "TechFollowUpTask_statusCrm_fkey" FOREIGN KEY ("statusCrm") REFERENCES "SaasWorkspaceCrmStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechProposal" ADD CONSTRAINT "TechProposal_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechProposal" ADD CONSTRAINT "TechProposal_workspace_fkey" FOREIGN KEY ("workspace") REFERENCES "SaasWorkspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechProposal" ADD CONSTRAINT "TechProposal_statusCrm_fkey" FOREIGN KEY ("statusCrm") REFERENCES "SaasWorkspaceCrmStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechSalesActivity" ADD CONSTRAINT "TechSalesActivity_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechSalesActivity" ADD CONSTRAINT "TechSalesActivity_workspace_fkey" FOREIGN KEY ("workspace") REFERENCES "SaasWorkspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechSalesActivity" ADD CONSTRAINT "TechSalesActivity_statusCrm_fkey" FOREIGN KEY ("statusCrm") REFERENCES "SaasWorkspaceCrmStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechTask" ADD CONSTRAINT "TechTask_businessLead_fkey" FOREIGN KEY ("businessLead") REFERENCES "TechBusinessLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechTask" ADD CONSTRAINT "TechTask_responsible_fkey" FOREIGN KEY ("responsible") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechTask" ADD CONSTRAINT "TechTask_workspace_fkey" FOREIGN KEY ("workspace") REFERENCES "SaasWorkspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechTask" ADD CONSTRAINT "TechTask_statusCrm_fkey" FOREIGN KEY ("statusCrm") REFERENCES "SaasWorkspaceCrmStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechTask" ADD CONSTRAINT "TechTask_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SaasWorkspace_members" ADD CONSTRAINT "_SaasWorkspace_members_A_fkey" FOREIGN KEY ("A") REFERENCES "SaasWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SaasWorkspace_members" ADD CONSTRAINT "_SaasWorkspace_members_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
