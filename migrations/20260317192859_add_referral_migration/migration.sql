/*
  Warnings:

  - A unique constraint covering the columns `[referralCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "referredBy" TEXT;

-- Assign unique referral codes to existing users (K + 5 alphanumeric from id hash)
UPDATE "User"
SET "referralCode" = 'K' || UPPER(SUBSTRING(MD5(id::text) FROM 1 FOR 5))
WHERE "referralCode" = '';

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_referredBy_idx" ON "User"("referredBy");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredBy_fkey" FOREIGN KEY ("referredBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
