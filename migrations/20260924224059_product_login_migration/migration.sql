-- AlterTable
ALTER TABLE "User" ADD COLUMN     "product" TEXT NOT NULL DEFAULT 'pet';

-- CreateIndex
CREATE INDEX "User_product_idx" ON "User"("product");
