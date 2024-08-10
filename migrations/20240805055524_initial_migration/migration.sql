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
    "animal_type" TEXT,
    "user" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalType" (
    "id" TEXT NOT NULL,
    "name" TEXT DEFAULT 'dog',

    CONSTRAINT "AnimalType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Animal_animal_type_idx" ON "Animal"("animal_type");

-- CreateIndex
CREATE INDEX "Animal_user_idx" ON "Animal"("user");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalType_name_key" ON "AnimalType"("name");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_animal_type_fkey" FOREIGN KEY ("animal_type") REFERENCES "AnimalType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
