/*
  Warnings:

  - You are about to drop the column `active` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `end_date` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `pet_place` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `product` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `start_date` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Ad` table. All the data in the column will be lost.
  - You are about to drop the column `user` on the `Ad` table. All the data in the column will be lost.
  - The `lat` column on the `Ad` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `lng` column on the `Ad` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `status` on table `Ad` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Ad" DROP CONSTRAINT "Ad_pet_place_fkey";

-- DropForeignKey
ALTER TABLE "Ad" DROP CONSTRAINT "Ad_product_fkey";

-- DropForeignKey
ALTER TABLE "Ad" DROP CONSTRAINT "Ad_user_fkey";

-- DropIndex
DROP INDEX "Ad_pet_place_idx";

-- DropIndex
DROP INDEX "Ad_product_idx";

-- DropIndex
DROP INDEX "Ad_user_idx";

-- AlterTable
ALTER TABLE "Ad" DROP COLUMN "active",
DROP COLUMN "description",
DROP COLUMN "end_date",
DROP COLUMN "pet_place",
DROP COLUMN "price",
DROP COLUMN "product",
DROP COLUMN "start_date",
DROP COLUMN "type",
DROP COLUMN "user",
ADD COLUMN     "advertiserContact" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "advertiserName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "advertiserUser" TEXT,
ADD COLUMN     "animal" TEXT,
ADD COLUMN     "body" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "brandLabel" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ctaLabel" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "endDate" DATE,
ADD COLUMN     "geoScope" TEXT NOT NULL DEFAULT 'national',
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'brand',
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "petPlace" TEXT,
ADD COLUMN     "placements" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "priceCents" INTEGER DEFAULT 0,
ADD COLUMN     "radiusKm" INTEGER,
ADD COLUMN     "startDate" DATE,
ADD COLUMN     "storeProduct" TEXT,
ADD COLUMN     "tone" TEXT NOT NULL DEFAULT 'orange',
ADD COLUMN     "updatedAt" TIMESTAMP(3),
ADD COLUMN     "url" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "zoneLabel" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'draft',
DROP COLUMN "lat",
ADD COLUMN     "lat" DOUBLE PRECISION,
DROP COLUMN "lng",
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "AdDailyStat" (
    "id" TEXT NOT NULL,
    "ad" TEXT,
    "day" DATE NOT NULL,
    "placement" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdDailyStat_ad_idx" ON "AdDailyStat"("ad");

-- CreateIndex
CREATE INDEX "AdDailyStat_day_idx" ON "AdDailyStat"("day");

-- CreateIndex
CREATE UNIQUE INDEX "AdDailyStat_ad_day_placement_key" ON "AdDailyStat"("ad", "day", "placement");

-- CreateIndex
CREATE INDEX "Ad_storeProduct_idx" ON "Ad"("storeProduct");

-- CreateIndex
CREATE INDEX "Ad_petPlace_idx" ON "Ad"("petPlace");

-- CreateIndex
CREATE INDEX "Ad_animal_idx" ON "Ad"("animal");

-- CreateIndex
CREATE INDEX "Ad_advertiserUser_idx" ON "Ad"("advertiserUser");

-- CreateIndex
CREATE INDEX "Ad_status_endDate_idx" ON "Ad"("status", "endDate");

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_storeProduct_fkey" FOREIGN KEY ("storeProduct") REFERENCES "StoreProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_petPlace_fkey" FOREIGN KEY ("petPlace") REFERENCES "PetPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_animal_fkey" FOREIGN KEY ("animal") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_advertiserUser_fkey" FOREIGN KEY ("advertiserUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdDailyStat" ADD CONSTRAINT "AdDailyStat_ad_fkey" FOREIGN KEY ("ad") REFERENCES "Ad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
