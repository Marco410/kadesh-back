-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "publicProfileEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showEmailOnProfile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showPhoneOnProfile" BOOLEAN NOT NULL DEFAULT false;
