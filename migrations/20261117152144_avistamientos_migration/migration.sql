-- CreateTable
CREATE TABLE "AnimalSighting" (
    "id" TEXT NOT NULL,
    "animal" TEXT,
    "user" TEXT,
    "seenAt" TIMESTAMP(3) NOT NULL,
    "lat" TEXT NOT NULL DEFAULT '',
    "lng" TEXT NOT NULL DEFAULT '',
    "placeLabel" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalSighting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalSighting_animal_idx" ON "AnimalSighting"("animal");

-- CreateIndex
CREATE INDEX "AnimalSighting_user_idx" ON "AnimalSighting"("user");

-- AddForeignKey
ALTER TABLE "AnimalSighting" ADD CONSTRAINT "AnimalSighting_animal_fkey" FOREIGN KEY ("animal") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalSighting" ADD CONSTRAINT "AnimalSighting_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
