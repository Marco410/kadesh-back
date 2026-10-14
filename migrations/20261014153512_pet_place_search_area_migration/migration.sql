-- CreateTable
CREATE TABLE "PetPlaceSearchArea" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "radiusKm" DOUBLE PRECISION,
    "googleResults" INTEGER DEFAULT 0,
    "searchedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetPlaceSearchArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PetPlaceSearchArea_key_key" ON "PetPlaceSearchArea"("key");

