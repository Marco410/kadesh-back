-- CreateTable
CREATE TABLE "StoreAddress" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "label" TEXT NOT NULL DEFAULT '',
    "recipientName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "street" TEXT NOT NULL DEFAULT '',
    "exteriorNumber" TEXT NOT NULL DEFAULT '',
    "interiorNumber" TEXT NOT NULL DEFAULT '',
    "neighborhood" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "stateCode" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "references" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreBrand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT,
    "logo_id" TEXT,
    "logo_filesize" INTEGER,
    "logo_width" INTEGER,
    "logo_height" INTEGER,
    "logo_extension" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT,
    "parent" TEXT,
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCoupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'percent',
    "value" INTEGER NOT NULL DEFAULT 0,
    "minSubtotalCents" INTEGER,
    "maxDiscountCents" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usageLimitPerUser" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "firstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCouponRedemption" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "coupon" TEXT,
    "order" TEXT,
    "user" TEXT,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreCouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL DEFAULT '',
    "checkoutKey" TEXT,
    "user" TEXT,
    "customerName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "channel" TEXT DEFAULT 'web',
    "guestCheckout" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'unfulfilled',
    "unitsCount" INTEGER DEFAULT 0,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "couponCode" TEXT,
    "couponDiscountCents" INTEGER NOT NULL DEFAULT 0,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER DEFAULT 0,
    "paymentMethod" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "shipRecipientName" TEXT NOT NULL DEFAULT '',
    "shipPhone" TEXT NOT NULL DEFAULT '',
    "shipStreet" TEXT NOT NULL DEFAULT '',
    "shipExteriorNumber" TEXT NOT NULL DEFAULT '',
    "shipInteriorNumber" TEXT NOT NULL DEFAULT '',
    "shipNeighborhood" TEXT NOT NULL DEFAULT '',
    "shipCity" TEXT NOT NULL DEFAULT '',
    "shipStateCode" TEXT NOT NULL DEFAULT '',
    "shipPostalCode" TEXT NOT NULL DEFAULT '',
    "shipReferences" TEXT NOT NULL DEFAULT '',
    "customerNote" TEXT NOT NULL DEFAULT '',
    "adminNote" TEXT NOT NULL DEFAULT '',
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOrderEvent" (
    "id" TEXT NOT NULL,
    "order" TEXT,
    "type" TEXT NOT NULL DEFAULT '',
    "fromStatus" TEXT NOT NULL DEFAULT '',
    "toStatus" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOrderItem" (
    "id" TEXT NOT NULL,
    "order" TEXT,
    "product" TEXT,
    "variant" TEXT,
    "shipment" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "variantTitle" TEXT NOT NULL DEFAULT '',
    "sku" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "externalId" TEXT,
    "dropiVariationId" INTEGER,
    "dropiSupplierId" INTEGER,
    "unitPriceCents" INTEGER NOT NULL,
    "unitCostCents" INTEGER,
    "quantity" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorePayment" (
    "id" TEXT NOT NULL,
    "order" TEXT,
    "provider" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeRefundId" TEXT,
    "refundedCents" INTEGER DEFAULT 0,
    "transferProof_id" TEXT,
    "transferProof_filesize" INTEGER,
    "transferProof_width" INTEGER,
    "transferProof_height" INTEGER,
    "transferProof_extension" TEXT,
    "transferReference" TEXT NOT NULL DEFAULT '',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT,
    "nameSearch" TEXT NOT NULL DEFAULT '',
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'own',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "category" TEXT,
    "brand" TEXT,
    "priceCents" INTEGER DEFAULT 0,
    "compareAtPriceCents" INTEGER,
    "inventoryPolicy" TEXT NOT NULL DEFAULT 'tracked',
    "stockTotal" INTEGER DEFAULT 0,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "affiliateUrl" TEXT,
    "dropiSupplierId" INTEGER,
    "suggestedPriceCents" INTEGER,
    "externalSyncedAt" TIMESTAMP(3),
    "ratingAverage" DOUBLE PRECISION DEFAULT 0,
    "ratingCount" INTEGER DEFAULT 0,
    "salesCount" INTEGER DEFAULT 0,
    "metaTitle" TEXT NOT NULL DEFAULT '',
    "metaDescription" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProductImage" (
    "id" TEXT NOT NULL,
    "product" TEXT,
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "externalUrl" TEXT,
    "alt" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProductReview" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "product" TEXT,
    "user" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'published',
    "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "adminReply" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProductVariant" (
    "id" TEXT NOT NULL,
    "product" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "sku" TEXT,
    "options" JSONB,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "compareAtPriceCents" INTEGER,
    "costCents" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "dropiVariationId" INTEGER,
    "weightGrams" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL,
    "shippingFlatCents" INTEGER NOT NULL DEFAULT 9900,
    "freeShippingMinCents" INTEGER DEFAULT 79900,
    "cardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "transferEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bankName" TEXT NOT NULL DEFAULT '',
    "bankBeneficiary" TEXT NOT NULL DEFAULT '',
    "bankClabe" TEXT NOT NULL DEFAULT '',
    "bankNote" TEXT NOT NULL DEFAULT '',
    "transferExpiryHours" INTEGER NOT NULL DEFAULT 48,
    "cardExpiryMinutes" INTEGER NOT NULL DEFAULT 60,
    "returnPolicy" TEXT NOT NULL DEFAULT '',
    "supportWhatsapp" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreShipment" (
    "id" TEXT NOT NULL,
    "order" TEXT,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "carrier" TEXT NOT NULL DEFAULT '',
    "trackingCode" TEXT NOT NULL DEFAULT '',
    "trackingUrl" TEXT NOT NULL DEFAULT '',
    "shippingCostCents" INTEGER,
    "dropiOrderId" TEXT,
    "dropiStatus" TEXT NOT NULL DEFAULT '',
    "dropiSupplierId" INTEGER,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreWishlistItem" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "user" TEXT,
    "product" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreWishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_StoreProduct_animalTypes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_StoreCoupon_categories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_StoreCoupon_products" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "StoreAddress_user_idx" ON "StoreAddress"("user");

-- CreateIndex
CREATE UNIQUE INDEX "StoreBrand_slug_key" ON "StoreBrand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "StoreCategory_slug_key" ON "StoreCategory"("slug");

-- CreateIndex
CREATE INDEX "StoreCategory_parent_idx" ON "StoreCategory"("parent");

-- CreateIndex
CREATE UNIQUE INDEX "StoreCoupon_code_key" ON "StoreCoupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StoreCouponRedemption_key_key" ON "StoreCouponRedemption"("key");

-- CreateIndex
CREATE INDEX "StoreCouponRedemption_coupon_idx" ON "StoreCouponRedemption"("coupon");

-- CreateIndex
CREATE INDEX "StoreCouponRedemption_order_idx" ON "StoreCouponRedemption"("order");

-- CreateIndex
CREATE INDEX "StoreCouponRedemption_user_idx" ON "StoreCouponRedemption"("user");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_number_key" ON "StoreOrder"("number");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_checkoutKey_key" ON "StoreOrder"("checkoutKey");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_stripePaymentIntentId_key" ON "StoreOrder"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "StoreOrder_user_idx" ON "StoreOrder"("user");

-- CreateIndex
CREATE INDEX "StoreOrder_searchText_idx" ON "StoreOrder"("searchText");

-- CreateIndex
CREATE INDEX "StoreOrder_user_createdAt_idx" ON "StoreOrder"("user", "createdAt");

-- CreateIndex
CREATE INDEX "StoreOrder_paymentStatus_createdAt_idx" ON "StoreOrder"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "StoreOrder_fulfillmentStatus_createdAt_idx" ON "StoreOrder"("fulfillmentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "StoreOrder_status_expiresAt_idx" ON "StoreOrder"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "StoreOrder_paidAt_idx" ON "StoreOrder"("paidAt");

-- CreateIndex
CREATE INDEX "StoreOrderEvent_order_idx" ON "StoreOrderEvent"("order");

-- CreateIndex
CREATE INDEX "StoreOrderEvent_actor_idx" ON "StoreOrderEvent"("actor");

-- CreateIndex
CREATE INDEX "StoreOrderEvent_order_createdAt_idx" ON "StoreOrderEvent"("order", "createdAt");

-- CreateIndex
CREATE INDEX "StoreOrderItem_order_idx" ON "StoreOrderItem"("order");

-- CreateIndex
CREATE INDEX "StoreOrderItem_product_idx" ON "StoreOrderItem"("product");

-- CreateIndex
CREATE INDEX "StoreOrderItem_variant_idx" ON "StoreOrderItem"("variant");

-- CreateIndex
CREATE INDEX "StoreOrderItem_shipment_idx" ON "StoreOrderItem"("shipment");

-- CreateIndex
CREATE UNIQUE INDEX "StorePayment_stripeChargeId_key" ON "StorePayment"("stripeChargeId");

-- CreateIndex
CREATE INDEX "StorePayment_order_idx" ON "StorePayment"("order");

-- CreateIndex
CREATE INDEX "StorePayment_status_idx" ON "StorePayment"("status");

-- CreateIndex
CREATE INDEX "StorePayment_stripePaymentIntentId_idx" ON "StorePayment"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "StorePayment_reviewedBy_idx" ON "StorePayment"("reviewedBy");

-- CreateIndex
CREATE UNIQUE INDEX "StoreProduct_slug_key" ON "StoreProduct"("slug");

-- CreateIndex
CREATE INDEX "StoreProduct_nameSearch_idx" ON "StoreProduct"("nameSearch");

-- CreateIndex
CREATE INDEX "StoreProduct_source_idx" ON "StoreProduct"("source");

-- CreateIndex
CREATE INDEX "StoreProduct_status_idx" ON "StoreProduct"("status");

-- CreateIndex
CREATE INDEX "StoreProduct_category_idx" ON "StoreProduct"("category");

-- CreateIndex
CREATE INDEX "StoreProduct_brand_idx" ON "StoreProduct"("brand");

-- CreateIndex
CREATE INDEX "StoreProduct_status_category_idx" ON "StoreProduct"("status", "category");

-- CreateIndex
CREATE INDEX "StoreProduct_status_publishedAt_idx" ON "StoreProduct"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoreProduct_source_externalId_key" ON "StoreProduct"("source", "externalId");

-- CreateIndex
CREATE INDEX "StoreProductImage_product_idx" ON "StoreProductImage"("product");

-- CreateIndex
CREATE UNIQUE INDEX "StoreProductReview_key_key" ON "StoreProductReview"("key");

-- CreateIndex
CREATE INDEX "StoreProductReview_product_idx" ON "StoreProductReview"("product");

-- CreateIndex
CREATE INDEX "StoreProductReview_user_idx" ON "StoreProductReview"("user");

-- CreateIndex
CREATE INDEX "StoreProductReview_status_idx" ON "StoreProductReview"("status");

-- CreateIndex
CREATE INDEX "StoreProductReview_product_status_createdAt_idx" ON "StoreProductReview"("product", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StoreProductVariant_product_idx" ON "StoreProductVariant"("product");

-- CreateIndex
CREATE INDEX "StoreProductVariant_sku_idx" ON "StoreProductVariant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "StoreShipment_dropiOrderId_key" ON "StoreShipment"("dropiOrderId");

-- CreateIndex
CREATE INDEX "StoreShipment_order_idx" ON "StoreShipment"("order");

-- CreateIndex
CREATE INDEX "StoreShipment_status_idx" ON "StoreShipment"("status");

-- CreateIndex
CREATE INDEX "StoreShipment_approvedBy_idx" ON "StoreShipment"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "StoreWishlistItem_key_key" ON "StoreWishlistItem"("key");

-- CreateIndex
CREATE INDEX "StoreWishlistItem_user_idx" ON "StoreWishlistItem"("user");

-- CreateIndex
CREATE INDEX "StoreWishlistItem_product_idx" ON "StoreWishlistItem"("product");

-- CreateIndex
CREATE UNIQUE INDEX "_StoreProduct_animalTypes_AB_unique" ON "_StoreProduct_animalTypes"("A", "B");

-- CreateIndex
CREATE INDEX "_StoreProduct_animalTypes_B_index" ON "_StoreProduct_animalTypes"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_StoreCoupon_categories_AB_unique" ON "_StoreCoupon_categories"("A", "B");

-- CreateIndex
CREATE INDEX "_StoreCoupon_categories_B_index" ON "_StoreCoupon_categories"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_StoreCoupon_products_AB_unique" ON "_StoreCoupon_products"("A", "B");

-- CreateIndex
CREATE INDEX "_StoreCoupon_products_B_index" ON "_StoreCoupon_products"("B");

-- AddForeignKey
ALTER TABLE "StoreAddress" ADD CONSTRAINT "StoreAddress_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCategory" ADD CONSTRAINT "StoreCategory_parent_fkey" FOREIGN KEY ("parent") REFERENCES "StoreCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCouponRedemption" ADD CONSTRAINT "StoreCouponRedemption_coupon_fkey" FOREIGN KEY ("coupon") REFERENCES "StoreCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCouponRedemption" ADD CONSTRAINT "StoreCouponRedemption_order_fkey" FOREIGN KEY ("order") REFERENCES "StoreOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCouponRedemption" ADD CONSTRAINT "StoreCouponRedemption_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderEvent" ADD CONSTRAINT "StoreOrderEvent_order_fkey" FOREIGN KEY ("order") REFERENCES "StoreOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderEvent" ADD CONSTRAINT "StoreOrderEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_order_fkey" FOREIGN KEY ("order") REFERENCES "StoreOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_product_fkey" FOREIGN KEY ("product") REFERENCES "StoreProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_variant_fkey" FOREIGN KEY ("variant") REFERENCES "StoreProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_shipment_fkey" FOREIGN KEY ("shipment") REFERENCES "StoreShipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePayment" ADD CONSTRAINT "StorePayment_order_fkey" FOREIGN KEY ("order") REFERENCES "StoreOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePayment" ADD CONSTRAINT "StorePayment_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_category_fkey" FOREIGN KEY ("category") REFERENCES "StoreCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_brand_fkey" FOREIGN KEY ("brand") REFERENCES "StoreBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProductImage" ADD CONSTRAINT "StoreProductImage_product_fkey" FOREIGN KEY ("product") REFERENCES "StoreProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProductReview" ADD CONSTRAINT "StoreProductReview_product_fkey" FOREIGN KEY ("product") REFERENCES "StoreProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProductReview" ADD CONSTRAINT "StoreProductReview_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProductVariant" ADD CONSTRAINT "StoreProductVariant_product_fkey" FOREIGN KEY ("product") REFERENCES "StoreProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreShipment" ADD CONSTRAINT "StoreShipment_order_fkey" FOREIGN KEY ("order") REFERENCES "StoreOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreShipment" ADD CONSTRAINT "StoreShipment_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreWishlistItem" ADD CONSTRAINT "StoreWishlistItem_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreWishlistItem" ADD CONSTRAINT "StoreWishlistItem_product_fkey" FOREIGN KEY ("product") REFERENCES "StoreProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StoreProduct_animalTypes" ADD CONSTRAINT "_StoreProduct_animalTypes_A_fkey" FOREIGN KEY ("A") REFERENCES "AnimalType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StoreProduct_animalTypes" ADD CONSTRAINT "_StoreProduct_animalTypes_B_fkey" FOREIGN KEY ("B") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StoreCoupon_categories" ADD CONSTRAINT "_StoreCoupon_categories_A_fkey" FOREIGN KEY ("A") REFERENCES "StoreCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StoreCoupon_categories" ADD CONSTRAINT "_StoreCoupon_categories_B_fkey" FOREIGN KEY ("B") REFERENCES "StoreCoupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StoreCoupon_products" ADD CONSTRAINT "_StoreCoupon_products_A_fkey" FOREIGN KEY ("A") REFERENCES "StoreCoupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StoreCoupon_products" ADD CONSTRAINT "_StoreCoupon_products_B_fkey" FOREIGN KEY ("B") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
