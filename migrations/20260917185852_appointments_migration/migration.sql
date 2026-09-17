/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `PetPlace` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PetPlace" ADD COLUMN     "appointmentRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "claimNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "claimPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "claimRole" TEXT,
ADD COLUMN     "claimStatus" TEXT DEFAULT 'unclaimed',
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emergencies" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "whatsapp" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "PetPlaceAppointment" (
    "id" TEXT NOT NULL,
    "pet_place" TEXT,
    "customer" TEXT,
    "service" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "petName" TEXT NOT NULL DEFAULT '',
    "petSpecies" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "ownerNotes" TEXT NOT NULL DEFAULT '',
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetPlaceAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PetPlaceAppointment_pet_place_idx" ON "PetPlaceAppointment"("pet_place");

-- CreateIndex
CREATE INDEX "PetPlaceAppointment_customer_idx" ON "PetPlaceAppointment"("customer");

-- CreateIndex
CREATE INDEX "PetPlaceAppointment_service_idx" ON "PetPlaceAppointment"("service");

-- CreateIndex
CREATE UNIQUE INDEX "PetPlace_slug_key" ON "PetPlace"("slug");

-- AddForeignKey
ALTER TABLE "PetPlaceAppointment" ADD CONSTRAINT "PetPlaceAppointment_pet_place_fkey" FOREIGN KEY ("pet_place") REFERENCES "PetPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetPlaceAppointment" ADD CONSTRAINT "PetPlaceAppointment_customer_fkey" FOREIGN KEY ("customer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetPlaceAppointment" ADD CONSTRAINT "PetPlaceAppointment_service_fkey" FOREIGN KEY ("service") REFERENCES "PetPlaceService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
