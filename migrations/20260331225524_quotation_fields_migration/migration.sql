-- AlterTable
ALTER TABLE "SaasQuotation" ADD COLUMN     "showNotes" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "businessEmail" TEXT,
ADD COLUMN     "businessPhone" TEXT,
ALTER COLUMN "secondLastName" DROP NOT NULL,
ALTER COLUMN "secondLastName" DROP DEFAULT;
