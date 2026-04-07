-- CreateTable
CREATE TABLE "UserAuthLog" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "source" TEXT,
    "step" TEXT NOT NULL DEFAULT '',
    "success" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL DEFAULT '',
    "emailMasked" TEXT NOT NULL DEFAULT '',
    "responseSnapshot" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAuthLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAuthLog_user_idx" ON "UserAuthLog"("user");

-- CreateIndex
CREATE INDEX "UserAuthLog_step_idx" ON "UserAuthLog"("step");

-- AddForeignKey
ALTER TABLE "UserAuthLog" ADD CONSTRAINT "UserAuthLog_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
