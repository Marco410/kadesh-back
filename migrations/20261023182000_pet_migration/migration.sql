/*
  Warnings:

  - You are about to drop the column `user` on the `Pet` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Pet" DROP CONSTRAINT "Pet_user_fkey";

-- DropIndex
DROP INDEX "Pet_user_idx";

-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "pet" TEXT;

-- AlterTable
ALTER TABLE "Pet" DROP COLUMN "user",
ADD COLUMN     "approximateAge" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "color" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "distinctiveMarks" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lostReport" TEXT,
ADD COLUMN     "microchipNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sex" TEXT DEFAULT 'unknown',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "sterilized" TEXT DEFAULT 'unknown',
ADD COLUMN     "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "weightKg" DECIMAL(6,2),
ALTER COLUMN "birthday" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PetMultimedia" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PetPlaceAppointment" ADD COLUMN     "pet" TEXT;

-- CreateTable
CREATE TABLE "PetOwner" (
    "id" TEXT NOT NULL,
    "pet" TEXT,
    "user" TEXT,
    "role" TEXT NOT NULL DEFAULT 'family',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetHealthRecord" (
    "id" TEXT NOT NULL,
    "pet" TEXT,
    "type" TEXT NOT NULL DEFAULT 'vaccine',
    "name" TEXT NOT NULL DEFAULT '',
    "appliedDate" DATE NOT NULL,
    "nextDueDate" DATE,
    "veterinary" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "verifiedByVet" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetHealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetHealthRecordAttachment" (
    "id" TEXT NOT NULL,
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "healthRecord" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetHealthRecordAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetReminder" (
    "id" TEXT NOT NULL,
    "pet" TEXT,
    "healthRecord" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "dueDate" DATE NOT NULL,
    "notifyDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "channels" JSONB NOT NULL DEFAULT '["push","email"]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PetOwner_pet_idx" ON "PetOwner"("pet");

-- CreateIndex
CREATE INDEX "PetOwner_user_idx" ON "PetOwner"("user");

-- CreateIndex
CREATE INDEX "PetHealthRecord_pet_idx" ON "PetHealthRecord"("pet");

-- CreateIndex
CREATE INDEX "PetHealthRecord_veterinary_idx" ON "PetHealthRecord"("veterinary");

-- CreateIndex
CREATE INDEX "PetHealthRecord_createdBy_idx" ON "PetHealthRecord"("createdBy");

-- CreateIndex
CREATE INDEX "PetHealthRecordAttachment_healthRecord_idx" ON "PetHealthRecordAttachment"("healthRecord");

-- CreateIndex
CREATE UNIQUE INDEX "PetReminder_healthRecord_key" ON "PetReminder"("healthRecord");

-- CreateIndex
CREATE INDEX "PetReminder_pet_idx" ON "PetReminder"("pet");

-- CreateIndex
CREATE INDEX "Animal_pet_idx" ON "Animal"("pet");

-- CreateIndex
CREATE INDEX "Pet_lostReport_idx" ON "Pet"("lostReport");

-- CreateIndex
CREATE INDEX "PetPlaceAppointment_pet_idx" ON "PetPlaceAppointment"("pet");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_pet_fkey" FOREIGN KEY ("pet") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_lostReport_fkey" FOREIGN KEY ("lostReport") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetOwner" ADD CONSTRAINT "PetOwner_pet_fkey" FOREIGN KEY ("pet") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetOwner" ADD CONSTRAINT "PetOwner_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetHealthRecord" ADD CONSTRAINT "PetHealthRecord_pet_fkey" FOREIGN KEY ("pet") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetHealthRecord" ADD CONSTRAINT "PetHealthRecord_veterinary_fkey" FOREIGN KEY ("veterinary") REFERENCES "PetPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetHealthRecord" ADD CONSTRAINT "PetHealthRecord_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetHealthRecordAttachment" ADD CONSTRAINT "PetHealthRecordAttachment_healthRecord_fkey" FOREIGN KEY ("healthRecord") REFERENCES "PetHealthRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetReminder" ADD CONSTRAINT "PetReminder_pet_fkey" FOREIGN KEY ("pet") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetReminder" ADD CONSTRAINT "PetReminder_healthRecord_fkey" FOREIGN KEY ("healthRecord") REFERENCES "PetHealthRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetPlaceAppointment" ADD CONSTRAINT "PetPlaceAppointment_pet_fkey" FOREIGN KEY ("pet") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
