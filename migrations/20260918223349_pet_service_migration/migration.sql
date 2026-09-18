/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `PetPlaceService` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PetPlaceService" ADD COLUMN     "requestedBy" TEXT,
ADD COLUMN     "requestedFor" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'approved',
ALTER COLUMN "active" SET DEFAULT true;

-- CreateTable
CREATE TABLE "_PetPlace_patients" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PetPlace_patients_AB_unique" ON "_PetPlace_patients"("A", "B");

-- CreateIndex
CREATE INDEX "_PetPlace_patients_B_index" ON "_PetPlace_patients"("B");

-- CreateIndex
CREATE UNIQUE INDEX "PetPlaceService_slug_key" ON "PetPlaceService"("slug");

-- CreateIndex
CREATE INDEX "PetPlaceService_requestedBy_idx" ON "PetPlaceService"("requestedBy");

-- CreateIndex
CREATE INDEX "PetPlaceService_requestedFor_idx" ON "PetPlaceService"("requestedFor");

-- AddForeignKey
ALTER TABLE "PetPlaceService" ADD CONSTRAINT "PetPlaceService_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetPlaceService" ADD CONSTRAINT "PetPlaceService_requestedFor_fkey" FOREIGN KEY ("requestedFor") REFERENCES "PetPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PetPlace_patients" ADD CONSTRAINT "_PetPlace_patients_A_fkey" FOREIGN KEY ("A") REFERENCES "PetPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PetPlace_patients" ADD CONSTRAINT "_PetPlace_patients_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
