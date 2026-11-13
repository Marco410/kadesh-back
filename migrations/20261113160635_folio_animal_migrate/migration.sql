/*
  Warnings:

  - A unique constraint covering the columns `[folio]` on the table `Animal` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "folio" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "AnimalClaim" ADD COLUMN     "petName" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "Animal_folio_key" ON "Animal"("folio");
