-- CreateTable
CREATE TABLE "BlogSubscription" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "user" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactForm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'new',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogSubscription_email_key" ON "BlogSubscription"("email");

-- CreateIndex
CREATE INDEX "BlogSubscription_user_idx" ON "BlogSubscription"("user");

-- AddForeignKey
ALTER TABLE "BlogSubscription" ADD CONSTRAINT "BlogSubscription_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
