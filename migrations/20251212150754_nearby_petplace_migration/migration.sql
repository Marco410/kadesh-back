/*
  Warnings:

  - You are about to drop the column `type` on the `PetPlace` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PetPlace" DROP COLUMN "type";

-- CreateTable
CREATE TABLE "PetPlaceType" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "plural" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PetPlaceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PetPlace_types" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PetPlaceType_value_key" ON "PetPlaceType"("value");

-- CreateIndex
CREATE UNIQUE INDEX "PetPlaceType_label_key" ON "PetPlaceType"("label");

-- CreateIndex
CREATE UNIQUE INDEX "_PetPlace_types_AB_unique" ON "_PetPlace_types"("A", "B");

-- CreateIndex
CREATE INDEX "_PetPlace_types_B_index" ON "_PetPlace_types"("B");

-- AddForeignKey
ALTER TABLE "_PetPlace_types" ADD CONSTRAINT "_PetPlace_types_A_fkey" FOREIGN KEY ("A") REFERENCES "PetPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PetPlace_types" ADD CONSTRAINT "_PetPlace_types_B_fkey" FOREIGN KEY ("B") REFERENCES "PetPlaceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
