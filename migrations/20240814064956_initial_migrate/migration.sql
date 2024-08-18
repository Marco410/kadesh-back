-- CreateEnum
CREATE TYPE "UserRoleType" AS ENUM ('admin', 'user');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "role" "UserRoleType" NOT NULL DEFAULT 'admin',
    "profileImage_id" TEXT,
    "profileImage_filesize" INTEGER,
    "profileImage_width" INTEGER,
    "profileImage_height" INTEGER,
    "profileImage_extension" TEXT,
    "birthday" DATE,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "animal_breed" TEXT,
    "user" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'dog',
    "order" INTEGER,

    CONSTRAINT "AnimalType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalMultimedia" (
    "id" TEXT NOT NULL,
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "animal" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalMultimedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalFavorite" (
    "id" TEXT NOT NULL,
    "animal" TEXT,
    "user" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalHistory" (
    "id" TEXT NOT NULL,
    "animal" TEXT,
    "status" TEXT DEFAULT 'Registrado',
    "notes" TEXT NOT NULL DEFAULT '',
    "lat" TEXT NOT NULL DEFAULT '',
    "lng" TEXT NOT NULL DEFAULT '',
    "last_seen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalComment" (
    "id" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "animal" TEXT,
    "user" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalBreed" (
    "id" TEXT NOT NULL,
    "breed" TEXT NOT NULL DEFAULT '',
    "animal_type" TEXT,

    CONSTRAINT "AnimalBreed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "birthday" DATE,
    "animal_breed" TEXT,
    "user" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetMultimedia" (
    "id" TEXT NOT NULL,
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "pet" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetMultimedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Veterinary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "street" TEXT NOT NULL DEFAULT '',
    "municipality" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "cp" TEXT NOT NULL DEFAULT '',
    "lat" TEXT NOT NULL DEFAULT '',
    "lng" TEXT NOT NULL DEFAULT '',
    "views" INTEGER,
    "user" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Veterinary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VeterinaryLike" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "veterinary" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VeterinaryLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VeterinaryService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VeterinaryService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Veterinary_services" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Animal_animal_breed_idx" ON "Animal"("animal_breed");

-- CreateIndex
CREATE INDEX "Animal_user_idx" ON "Animal"("user");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalType_name_key" ON "AnimalType"("name");

-- CreateIndex
CREATE INDEX "AnimalMultimedia_animal_idx" ON "AnimalMultimedia"("animal");

-- CreateIndex
CREATE INDEX "AnimalFavorite_animal_idx" ON "AnimalFavorite"("animal");

-- CreateIndex
CREATE INDEX "AnimalFavorite_user_idx" ON "AnimalFavorite"("user");

-- CreateIndex
CREATE INDEX "AnimalHistory_animal_idx" ON "AnimalHistory"("animal");

-- CreateIndex
CREATE INDEX "AnimalComment_animal_idx" ON "AnimalComment"("animal");

-- CreateIndex
CREATE INDEX "AnimalComment_user_idx" ON "AnimalComment"("user");

-- CreateIndex
CREATE INDEX "AnimalBreed_animal_type_idx" ON "AnimalBreed"("animal_type");

-- CreateIndex
CREATE INDEX "Pet_animal_breed_idx" ON "Pet"("animal_breed");

-- CreateIndex
CREATE INDEX "Pet_user_idx" ON "Pet"("user");

-- CreateIndex
CREATE INDEX "PetMultimedia_pet_idx" ON "PetMultimedia"("pet");

-- CreateIndex
CREATE INDEX "Veterinary_user_idx" ON "Veterinary"("user");

-- CreateIndex
CREATE INDEX "VeterinaryLike_user_idx" ON "VeterinaryLike"("user");

-- CreateIndex
CREATE INDEX "VeterinaryLike_veterinary_idx" ON "VeterinaryLike"("veterinary");

-- CreateIndex
CREATE UNIQUE INDEX "_Veterinary_services_AB_unique" ON "_Veterinary_services"("A", "B");

-- CreateIndex
CREATE INDEX "_Veterinary_services_B_index" ON "_Veterinary_services"("B");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_animal_breed_fkey" FOREIGN KEY ("animal_breed") REFERENCES "AnimalBreed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalMultimedia" ADD CONSTRAINT "AnimalMultimedia_animal_fkey" FOREIGN KEY ("animal") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalFavorite" ADD CONSTRAINT "AnimalFavorite_animal_fkey" FOREIGN KEY ("animal") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalFavorite" ADD CONSTRAINT "AnimalFavorite_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHistory" ADD CONSTRAINT "AnimalHistory_animal_fkey" FOREIGN KEY ("animal") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalComment" ADD CONSTRAINT "AnimalComment_animal_fkey" FOREIGN KEY ("animal") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalComment" ADD CONSTRAINT "AnimalComment_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalBreed" ADD CONSTRAINT "AnimalBreed_animal_type_fkey" FOREIGN KEY ("animal_type") REFERENCES "AnimalType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_animal_breed_fkey" FOREIGN KEY ("animal_breed") REFERENCES "AnimalBreed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetMultimedia" ADD CONSTRAINT "PetMultimedia_pet_fkey" FOREIGN KEY ("pet") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Veterinary" ADD CONSTRAINT "Veterinary_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VeterinaryLike" ADD CONSTRAINT "VeterinaryLike_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VeterinaryLike" ADD CONSTRAINT "VeterinaryLike_veterinary_fkey" FOREIGN KEY ("veterinary") REFERENCES "Veterinary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Veterinary_services" ADD CONSTRAINT "_Veterinary_services_A_fkey" FOREIGN KEY ("A") REFERENCES "Veterinary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Veterinary_services" ADD CONSTRAINT "_Veterinary_services_B_fkey" FOREIGN KEY ("B") REFERENCES "VeterinaryService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
