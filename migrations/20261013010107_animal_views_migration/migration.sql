-- CreateTable
CREATE TABLE "AnimalView" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "animal" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalView_user_idx" ON "AnimalView"("user");

-- CreateIndex
CREATE INDEX "AnimalView_animal_idx" ON "AnimalView"("animal");

-- AddForeignKey
ALTER TABLE "AnimalView" ADD CONSTRAINT "AnimalView_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalView" ADD CONSTRAINT "AnimalView_animal_fkey" FOREIGN KEY ("animal") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
