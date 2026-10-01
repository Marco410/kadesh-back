-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "contactNumber2" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reportedBy" TEXT DEFAULT 'owner',
ADD COLUMN     "sourceUrl" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "AnimalLog" ADD COLUMN     "neighborhood" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "placeLabel" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "postalCode" TEXT NOT NULL DEFAULT '';
