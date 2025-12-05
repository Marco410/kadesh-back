/*
  Warnings:

  - You are about to drop the column `pet_shelter` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the column `veterinary` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the column `pet_shelter` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the column `veterinary` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the column `pet_shelter` on the `SocialMedia` table. All the data in the column will be lost.
  - You are about to drop the column `veterinary` on the `SocialMedia` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `AnimalHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PetShelter` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Veterinary` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VeterinaryLike` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VeterinaryService` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_Veterinary_services` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AnimalHistory" DROP CONSTRAINT "AnimalHistory_animal_fkey";

-- DropForeignKey
ALTER TABLE "PetShelter" DROP CONSTRAINT "PetShelter_user_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_pet_shelter_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_veterinary_fkey";

-- DropForeignKey
ALTER TABLE "Schedule" DROP CONSTRAINT "Schedule_pet_shelter_fkey";

-- DropForeignKey
ALTER TABLE "Schedule" DROP CONSTRAINT "Schedule_veterinary_fkey";

-- DropForeignKey
ALTER TABLE "SocialMedia" DROP CONSTRAINT "SocialMedia_pet_shelter_fkey";

-- DropForeignKey
ALTER TABLE "SocialMedia" DROP CONSTRAINT "SocialMedia_veterinary_fkey";

-- DropForeignKey
ALTER TABLE "Veterinary" DROP CONSTRAINT "Veterinary_user_fkey";

-- DropForeignKey
ALTER TABLE "VeterinaryLike" DROP CONSTRAINT "VeterinaryLike_user_fkey";

-- DropForeignKey
ALTER TABLE "VeterinaryLike" DROP CONSTRAINT "VeterinaryLike_veterinary_fkey";

-- DropForeignKey
ALTER TABLE "_Veterinary_services" DROP CONSTRAINT "_Veterinary_services_A_fkey";

-- DropForeignKey
ALTER TABLE "_Veterinary_services" DROP CONSTRAINT "_Veterinary_services_B_fkey";

-- DropIndex
DROP INDEX "Review_pet_shelter_idx";

-- DropIndex
DROP INDEX "Review_veterinary_idx";

-- DropIndex
DROP INDEX "Schedule_pet_shelter_idx";

-- DropIndex
DROP INDEX "Schedule_veterinary_idx";

-- DropIndex
DROP INDEX "SocialMedia_pet_shelter_idx";

-- DropIndex
DROP INDEX "SocialMedia_veterinary_idx";

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "pet_shelter",
DROP COLUMN "veterinary",
ADD COLUMN     "pet_place" TEXT;

-- AlterTable
ALTER TABLE "Schedule" DROP COLUMN "pet_shelter",
DROP COLUMN "veterinary",
ADD COLUMN     "pet_place" TEXT;

-- AlterTable
ALTER TABLE "SocialMedia" DROP COLUMN "pet_shelter",
DROP COLUMN "veterinary",
ADD COLUMN     "pet_place" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";

-- DropTable
DROP TABLE "AnimalHistory";

-- DropTable
DROP TABLE "PetShelter";

-- DropTable
DROP TABLE "Veterinary";

-- DropTable
DROP TABLE "VeterinaryLike";

-- DropTable
DROP TABLE "VeterinaryService";

-- DropTable
DROP TABLE "_Veterinary_services";

-- DropEnum
DROP TYPE "UserRoleType";

-- CreateTable
CREATE TABLE "AnimalLog" (
    "id" TEXT NOT NULL,
    "animal" TEXT,
    "status" TEXT DEFAULT 'Registrado',
    "notes" TEXT NOT NULL DEFAULT '',
    "lat" TEXT NOT NULL DEFAULT '',
    "lng" TEXT NOT NULL DEFAULT '',
    "last_seen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetPlace" (
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
    "type" TEXT DEFAULT 'veterinary',
    "user" TEXT,
    "address" TEXT NOT NULL DEFAULT '',
    "google_place_id" TEXT NOT NULL DEFAULT '',
    "google_opening_hours" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetPlaceLike" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "pet_place" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetPlaceLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetPlaceService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetPlaceService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "start_date" DATE,
    "end_date" DATE,
    "price" INTEGER,
    "status" TEXT,
    "type" TEXT,
    "lat" TEXT NOT NULL DEFAULT '',
    "lng" TEXT NOT NULL DEFAULT '',
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "pet_place" TEXT,
    "product" TEXT,
    "user" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "content" JSONB NOT NULL DEFAULT '[{"type":"paragraph","children":[{"text":""}]}]',
    "excerpt" TEXT NOT NULL DEFAULT '',
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "category" TEXT,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "post" TEXT,
    "user" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "post" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostFavorite" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "post" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostView" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "post" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "url" TEXT NOT NULL DEFAULT '',
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PetPlace_services" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Post_tags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Role_users" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "AnimalLog_animal_idx" ON "AnimalLog"("animal");

-- CreateIndex
CREATE UNIQUE INDEX "PetPlace_google_place_id_key" ON "PetPlace"("google_place_id");

-- CreateIndex
CREATE INDEX "PetPlace_user_idx" ON "PetPlace"("user");

-- CreateIndex
CREATE INDEX "PetPlaceLike_user_idx" ON "PetPlaceLike"("user");

-- CreateIndex
CREATE INDEX "PetPlaceLike_pet_place_idx" ON "PetPlaceLike"("pet_place");

-- CreateIndex
CREATE INDEX "Ad_pet_place_idx" ON "Ad"("pet_place");

-- CreateIndex
CREATE INDEX "Ad_product_idx" ON "Ad"("product");

-- CreateIndex
CREATE INDEX "Ad_user_idx" ON "Ad"("user");

-- CreateIndex
CREATE UNIQUE INDEX "Post_url_key" ON "Post"("url");

-- CreateIndex
CREATE INDEX "Post_category_idx" ON "Post"("category");

-- CreateIndex
CREATE INDEX "Post_author_idx" ON "Post"("author");

-- CreateIndex
CREATE INDEX "PostComment_post_idx" ON "PostComment"("post");

-- CreateIndex
CREATE INDEX "PostComment_user_idx" ON "PostComment"("user");

-- CreateIndex
CREATE INDEX "PostLike_user_idx" ON "PostLike"("user");

-- CreateIndex
CREATE INDEX "PostLike_post_idx" ON "PostLike"("post");

-- CreateIndex
CREATE INDEX "PostFavorite_user_idx" ON "PostFavorite"("user");

-- CreateIndex
CREATE INDEX "PostFavorite_post_idx" ON "PostFavorite"("post");

-- CreateIndex
CREATE INDEX "PostView_user_idx" ON "PostView"("user");

-- CreateIndex
CREATE INDEX "PostView_post_idx" ON "PostView"("post");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_url_key" ON "Category"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_PetPlace_services_AB_unique" ON "_PetPlace_services"("A", "B");

-- CreateIndex
CREATE INDEX "_PetPlace_services_B_index" ON "_PetPlace_services"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Post_tags_AB_unique" ON "_Post_tags"("A", "B");

-- CreateIndex
CREATE INDEX "_Post_tags_B_index" ON "_Post_tags"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Role_users_AB_unique" ON "_Role_users"("A", "B");

-- CreateIndex
CREATE INDEX "_Role_users_B_index" ON "_Role_users"("B");

-- CreateIndex
CREATE INDEX "Review_pet_place_idx" ON "Review"("pet_place");

-- CreateIndex
CREATE INDEX "Schedule_pet_place_idx" ON "Schedule"("pet_place");

-- CreateIndex
CREATE INDEX "SocialMedia_pet_place_idx" ON "SocialMedia"("pet_place");

-- AddForeignKey
ALTER TABLE "AnimalLog" ADD CONSTRAINT "AnimalLog_animal_fkey" FOREIGN KEY ("animal") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetPlace" ADD CONSTRAINT "PetPlace_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetPlaceLike" ADD CONSTRAINT "PetPlaceLike_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetPlaceLike" ADD CONSTRAINT "PetPlaceLike_pet_place_fkey" FOREIGN KEY ("pet_place") REFERENCES "PetPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_pet_place_fkey" FOREIGN KEY ("pet_place") REFERENCES "PetPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialMedia" ADD CONSTRAINT "SocialMedia_pet_place_fkey" FOREIGN KEY ("pet_place") REFERENCES "PetPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_pet_place_fkey" FOREIGN KEY ("pet_place") REFERENCES "PetPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_pet_place_fkey" FOREIGN KEY ("pet_place") REFERENCES "PetPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_product_fkey" FOREIGN KEY ("product") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_category_fkey" FOREIGN KEY ("category") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_author_fkey" FOREIGN KEY ("author") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_post_fkey" FOREIGN KEY ("post") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_post_fkey" FOREIGN KEY ("post") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFavorite" ADD CONSTRAINT "PostFavorite_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFavorite" ADD CONSTRAINT "PostFavorite_post_fkey" FOREIGN KEY ("post") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_post_fkey" FOREIGN KEY ("post") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PetPlace_services" ADD CONSTRAINT "_PetPlace_services_A_fkey" FOREIGN KEY ("A") REFERENCES "PetPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PetPlace_services" ADD CONSTRAINT "_PetPlace_services_B_fkey" FOREIGN KEY ("B") REFERENCES "PetPlaceService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Post_tags" ADD CONSTRAINT "_Post_tags_A_fkey" FOREIGN KEY ("A") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Post_tags" ADD CONSTRAINT "_Post_tags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Role_users" ADD CONSTRAINT "_Role_users_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Role_users" ADD CONSTRAINT "_Role_users_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
