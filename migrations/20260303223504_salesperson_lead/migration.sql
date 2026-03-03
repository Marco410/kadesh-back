/*
  Warnings:

  - You are about to drop the column `assignedSeller` on the `TechBusinessLead` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "TechBusinessLead" DROP CONSTRAINT "TechBusinessLead_assignedSeller_fkey";

-- DropIndex
DROP INDEX "TechBusinessLead_assignedSeller_idx";

-- AlterTable
ALTER TABLE "TechBusinessLead" DROP COLUMN "assignedSeller",
ADD COLUMN     "salesPerson" TEXT;

-- CreateIndex
CREATE INDEX "TechBusinessLead_salesPerson_idx" ON "TechBusinessLead"("salesPerson");

-- AddForeignKey
ALTER TABLE "TechBusinessLead" ADD CONSTRAINT "TechBusinessLead_salesPerson_fkey" FOREIGN KEY ("salesPerson") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
