-- CreateEnum
CREATE TYPE "UserRoleType" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "PaymentStatusType" AS ENUM ('pending', 'processing', 'succeeded', 'cancelled', 'failed', 'refunded');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "secondLastName" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "password" TEXT,
    "phone" TEXT NOT NULL DEFAULT '',
    "role" "UserRoleType" NOT NULL DEFAULT 'user',
    "profileImage_id" TEXT,
    "profileImage_filesize" INTEGER,
    "profileImage_width" INTEGER,
    "profileImage_height" INTEGER,
    "profileImage_extension" TEXT,
    "birthday" DATE,
    "smsRegistrationId" TEXT NOT NULL DEFAULT '',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "animal_type" TEXT,
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
    "birthday" DATE NOT NULL,
    "animal_type" TEXT,
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
    "address" TEXT NOT NULL DEFAULT '',
    "google_place_id" TEXT NOT NULL DEFAULT '',
    "google_opening_hours" TEXT NOT NULL DEFAULT '',
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
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "timeIni" INTEGER NOT NULL,
    "timeEnd" INTEGER NOT NULL,
    "veterinary" TEXT,
    "pet_shelter" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMedia" (
    "id" TEXT NOT NULL,
    "social_media" TEXT NOT NULL,
    "link" TEXT NOT NULL DEFAULT '',
    "veterinary" TEXT,
    "pet_shelter" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rating" INTEGER,
    "review" TEXT NOT NULL DEFAULT '',
    "veterinary" TEXT,
    "pet_shelter" TEXT,
    "product" TEXT,
    "user" TEXT,
    "google_user" TEXT NOT NULL DEFAULT '',
    "google_user_photo" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetShelter" (
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

    CONSTRAINT "PetShelter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "user" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "user" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "total" INTEGER,
    "status" TEXT NOT NULL,
    "cart" TEXT,
    "user" TEXT,
    "payment" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "amount" DECIMAL(18,6) DEFAULT 0.000000,
    "status" "PaymentStatusType" NOT NULL DEFAULT 'pending',
    "processorStripeChargeId" TEXT NOT NULL DEFAULT '',
    "stripeErrorMessage" TEXT NOT NULL DEFAULT '',
    "processorRefundId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "cardType" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastFourDigits" TEXT NOT NULL DEFAULT '',
    "expMonth" TEXT NOT NULL DEFAULT '',
    "expYear" TEXT NOT NULL DEFAULT '',
    "stripeProcessorId" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "ownerName" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "type" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenNotification" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL DEFAULT '',
    "user" TEXT,

    CONSTRAINT "TokenNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Veterinary_services" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_WishList_product" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Cart_product" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Animal_animal_type_idx" ON "Animal"("animal_type");

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
CREATE INDEX "Pet_animal_type_idx" ON "Pet"("animal_type");

-- CreateIndex
CREATE INDEX "Pet_animal_breed_idx" ON "Pet"("animal_breed");

-- CreateIndex
CREATE INDEX "Pet_user_idx" ON "Pet"("user");

-- CreateIndex
CREATE INDEX "PetMultimedia_pet_idx" ON "PetMultimedia"("pet");

-- CreateIndex
CREATE UNIQUE INDEX "Veterinary_google_place_id_key" ON "Veterinary"("google_place_id");

-- CreateIndex
CREATE INDEX "Veterinary_user_idx" ON "Veterinary"("user");

-- CreateIndex
CREATE INDEX "VeterinaryLike_user_idx" ON "VeterinaryLike"("user");

-- CreateIndex
CREATE INDEX "VeterinaryLike_veterinary_idx" ON "VeterinaryLike"("veterinary");

-- CreateIndex
CREATE INDEX "Schedule_veterinary_idx" ON "Schedule"("veterinary");

-- CreateIndex
CREATE INDEX "Schedule_pet_shelter_idx" ON "Schedule"("pet_shelter");

-- CreateIndex
CREATE INDEX "SocialMedia_veterinary_idx" ON "SocialMedia"("veterinary");

-- CreateIndex
CREATE INDEX "SocialMedia_pet_shelter_idx" ON "SocialMedia"("pet_shelter");

-- CreateIndex
CREATE INDEX "Review_veterinary_idx" ON "Review"("veterinary");

-- CreateIndex
CREATE INDEX "Review_pet_shelter_idx" ON "Review"("pet_shelter");

-- CreateIndex
CREATE INDEX "Review_product_idx" ON "Review"("product");

-- CreateIndex
CREATE INDEX "Review_user_idx" ON "Review"("user");

-- CreateIndex
CREATE INDEX "PetShelter_user_idx" ON "PetShelter"("user");

-- CreateIndex
CREATE INDEX "WishList_user_idx" ON "WishList"("user");

-- CreateIndex
CREATE INDEX "Cart_user_idx" ON "Cart"("user");

-- CreateIndex
CREATE UNIQUE INDEX "Order_payment_key" ON "Order"("payment");

-- CreateIndex
CREATE INDEX "Order_cart_idx" ON "Order"("cart");

-- CreateIndex
CREATE INDEX "Order_user_idx" ON "Order"("user");

-- CreateIndex
CREATE INDEX "Payment_paymentMethod_idx" ON "Payment"("paymentMethod");

-- CreateIndex
CREATE INDEX "PaymentMethod_user_idx" ON "PaymentMethod"("user");

-- CreateIndex
CREATE INDEX "TokenNotification_user_idx" ON "TokenNotification"("user");

-- CreateIndex
CREATE UNIQUE INDEX "_Veterinary_services_AB_unique" ON "_Veterinary_services"("A", "B");

-- CreateIndex
CREATE INDEX "_Veterinary_services_B_index" ON "_Veterinary_services"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_WishList_product_AB_unique" ON "_WishList_product"("A", "B");

-- CreateIndex
CREATE INDEX "_WishList_product_B_index" ON "_WishList_product"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Cart_product_AB_unique" ON "_Cart_product"("A", "B");

-- CreateIndex
CREATE INDEX "_Cart_product_B_index" ON "_Cart_product"("B");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_animal_type_fkey" FOREIGN KEY ("animal_type") REFERENCES "AnimalType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_animal_type_fkey" FOREIGN KEY ("animal_type") REFERENCES "AnimalType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_veterinary_fkey" FOREIGN KEY ("veterinary") REFERENCES "Veterinary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_pet_shelter_fkey" FOREIGN KEY ("pet_shelter") REFERENCES "PetShelter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialMedia" ADD CONSTRAINT "SocialMedia_veterinary_fkey" FOREIGN KEY ("veterinary") REFERENCES "Veterinary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialMedia" ADD CONSTRAINT "SocialMedia_pet_shelter_fkey" FOREIGN KEY ("pet_shelter") REFERENCES "PetShelter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_veterinary_fkey" FOREIGN KEY ("veterinary") REFERENCES "Veterinary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_pet_shelter_fkey" FOREIGN KEY ("pet_shelter") REFERENCES "PetShelter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_product_fkey" FOREIGN KEY ("product") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetShelter" ADD CONSTRAINT "PetShelter_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishList" ADD CONSTRAINT "WishList_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cart_fkey" FOREIGN KEY ("cart") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethod_fkey" FOREIGN KEY ("paymentMethod") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenNotification" ADD CONSTRAINT "TokenNotification_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Veterinary_services" ADD CONSTRAINT "_Veterinary_services_A_fkey" FOREIGN KEY ("A") REFERENCES "Veterinary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Veterinary_services" ADD CONSTRAINT "_Veterinary_services_B_fkey" FOREIGN KEY ("B") REFERENCES "VeterinaryService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WishList_product" ADD CONSTRAINT "_WishList_product_A_fkey" FOREIGN KEY ("A") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WishList_product" ADD CONSTRAINT "_WishList_product_B_fkey" FOREIGN KEY ("B") REFERENCES "WishList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Cart_product" ADD CONSTRAINT "_Cart_product_A_fkey" FOREIGN KEY ("A") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Cart_product" ADD CONSTRAINT "_Cart_product_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
