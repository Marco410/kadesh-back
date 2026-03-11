-- AlterTable
ALTER TABLE "TechProposal" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false;
