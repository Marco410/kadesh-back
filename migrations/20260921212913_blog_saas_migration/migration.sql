-- DropIndex
DROP INDEX "BlogSubscription_email_key";

-- AlterTable
ALTER TABLE "BlogSubscription" ADD COLUMN     "product" TEXT NOT NULL DEFAULT 'pet';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "product" TEXT NOT NULL DEFAULT 'pet';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "product" TEXT NOT NULL DEFAULT 'pet';

-- CreateIndex
CREATE INDEX "BlogSubscription_email_idx" ON "BlogSubscription"("email");

-- CreateIndex
CREATE INDEX "BlogSubscription_product_idx" ON "BlogSubscription"("product");

-- CreateIndex
CREATE INDEX "Category_product_idx" ON "Category"("product");

-- CreateIndex
CREATE INDEX "Post_product_idx" ON "Post"("product");
