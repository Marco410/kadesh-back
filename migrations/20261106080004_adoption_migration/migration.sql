-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "organization" TEXT;

-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "adoptedAt" TIMESTAMP(3),
ADD COLUMN     "adoptedFromOrganization" TEXT,
ADD COLUMN     "fosterMember" TEXT,
ADD COLUMN     "intakeDate" DATE,
ADD COLUMN     "organization" TEXT,
ADD COLUMN     "publicReport" TEXT,
ADD COLUMN     "stage" TEXT;

-- CreateTable
CREATE TABLE "AdoptionApplication" (
    "id" TEXT NOT NULL,
    "animal" TEXT,
    "applicant" TEXT,
    "applicantName" TEXT NOT NULL DEFAULT '',
    "applicantEmail" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "answers" JSONB,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "pet" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdoptionApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RescueOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT,
    "type" TEXT NOT NULL DEFAULT 'independent',
    "description" TEXT NOT NULL DEFAULT '',
    "logo_id" TEXT,
    "logo_filesize" INTEGER,
    "logo_width" INTEGER,
    "logo_height" INTEGER,
    "logo_extension" TEXT,
    "cover_id" TEXT,
    "cover_filesize" INTEGER,
    "cover_width" INTEGER,
    "cover_height" INTEGER,
    "cover_extension" TEXT,
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "species" JSONB NOT NULL DEFAULT '[]',
    "capacity" INTEGER,
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "websiteUrl" TEXT NOT NULL DEFAULT '',
    "facebookUrl" TEXT NOT NULL DEFAULT '',
    "instagramUrl" TEXT NOT NULL DEFAULT '',
    "tiktokUrl" TEXT NOT NULL DEFAULT '',
    "donationUrl" TEXT NOT NULL DEFAULT '',
    "donationInfo" TEXT NOT NULL DEFAULT '',
    "needs" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statusNote" TEXT NOT NULL DEFAULT '',
    "verifiedAt" TIMESTAMP(3),
    "isAlly" BOOLEAN NOT NULL DEFAULT false,
    "allySince" TIMESTAMP(3),
    "allyOrder" INTEGER,
    "adminNotes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "RescueOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RescueOrganizationMember" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "user" TEXT,
    "role" TEXT NOT NULL DEFAULT 'volunteer',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RescueOrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetTransfer" (
    "id" TEXT NOT NULL,
    "pet" TEXT,
    "code" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "fromOrganization" TEXT,
    "createdBy" TEXT,
    "redeemedBy" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdoptionApplication_animal_idx" ON "AdoptionApplication"("animal");

-- CreateIndex
CREATE INDEX "AdoptionApplication_applicant_idx" ON "AdoptionApplication"("applicant");

-- CreateIndex
CREATE INDEX "AdoptionApplication_decidedBy_idx" ON "AdoptionApplication"("decidedBy");

-- CreateIndex
CREATE INDEX "AdoptionApplication_pet_idx" ON "AdoptionApplication"("pet");

-- CreateIndex
CREATE UNIQUE INDEX "RescueOrganization_slug_key" ON "RescueOrganization"("slug");

-- CreateIndex
CREATE INDEX "RescueOrganization_status_idx" ON "RescueOrganization"("status");

-- CreateIndex
CREATE INDEX "RescueOrganization_createdBy_idx" ON "RescueOrganization"("createdBy");

-- CreateIndex
CREATE INDEX "RescueOrganizationMember_organization_idx" ON "RescueOrganizationMember"("organization");

-- CreateIndex
CREATE INDEX "RescueOrganizationMember_user_idx" ON "RescueOrganizationMember"("user");

-- CreateIndex
CREATE UNIQUE INDEX "PetTransfer_code_key" ON "PetTransfer"("code");

-- CreateIndex
CREATE INDEX "PetTransfer_pet_idx" ON "PetTransfer"("pet");

-- CreateIndex
CREATE INDEX "PetTransfer_fromOrganization_idx" ON "PetTransfer"("fromOrganization");

-- CreateIndex
CREATE INDEX "PetTransfer_createdBy_idx" ON "PetTransfer"("createdBy");

-- CreateIndex
CREATE INDEX "PetTransfer_redeemedBy_idx" ON "PetTransfer"("redeemedBy");

-- CreateIndex
CREATE INDEX "Animal_organization_idx" ON "Animal"("organization");

-- CreateIndex
CREATE INDEX "Pet_organization_idx" ON "Pet"("organization");

-- CreateIndex
CREATE INDEX "Pet_fosterMember_idx" ON "Pet"("fosterMember");

-- CreateIndex
CREATE INDEX "Pet_publicReport_idx" ON "Pet"("publicReport");

-- CreateIndex
CREATE INDEX "Pet_adoptedFromOrganization_idx" ON "Pet"("adoptedFromOrganization");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_organization_fkey" FOREIGN KEY ("organization") REFERENCES "RescueOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdoptionApplication" ADD CONSTRAINT "AdoptionApplication_animal_fkey" FOREIGN KEY ("animal") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdoptionApplication" ADD CONSTRAINT "AdoptionApplication_applicant_fkey" FOREIGN KEY ("applicant") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdoptionApplication" ADD CONSTRAINT "AdoptionApplication_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdoptionApplication" ADD CONSTRAINT "AdoptionApplication_pet_fkey" FOREIGN KEY ("pet") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_organization_fkey" FOREIGN KEY ("organization") REFERENCES "RescueOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_fosterMember_fkey" FOREIGN KEY ("fosterMember") REFERENCES "RescueOrganizationMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_publicReport_fkey" FOREIGN KEY ("publicReport") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_adoptedFromOrganization_fkey" FOREIGN KEY ("adoptedFromOrganization") REFERENCES "RescueOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescueOrganization" ADD CONSTRAINT "RescueOrganization_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescueOrganizationMember" ADD CONSTRAINT "RescueOrganizationMember_organization_fkey" FOREIGN KEY ("organization") REFERENCES "RescueOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescueOrganizationMember" ADD CONSTRAINT "RescueOrganizationMember_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetTransfer" ADD CONSTRAINT "PetTransfer_pet_fkey" FOREIGN KEY ("pet") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetTransfer" ADD CONSTRAINT "PetTransfer_fromOrganization_fkey" FOREIGN KEY ("fromOrganization") REFERENCES "RescueOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetTransfer" ADD CONSTRAINT "PetTransfer_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetTransfer" ADD CONSTRAINT "PetTransfer_redeemedBy_fkey" FOREIGN KEY ("redeemedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
