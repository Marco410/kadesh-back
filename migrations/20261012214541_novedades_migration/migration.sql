/*
  Warnings:

  - A unique constraint covering the columns `[businessLead,saasCompany]` on the table `TechStatusBusinessLead` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SystemRelease" ADD COLUMN     "emailedAt" TIMESTAMP(3),
ADD COLUMN     "notifyByEmail" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "TechStatusBusinessLead_businessLead_saasCompany_key" ON "TechStatusBusinessLead"("businessLead", "saasCompany");
