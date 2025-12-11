-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "sex" TEXT DEFAULT 'male';

-- AlterTable
ALTER TABLE "AnimalLog" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "city" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "country" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "state" TEXT NOT NULL DEFAULT '';
