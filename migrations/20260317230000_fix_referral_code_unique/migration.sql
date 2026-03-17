-- Fix duplicate empty referralCode: assign unique K + 5 chars to existing users
UPDATE "User"
SET "referralCode" = 'K' || UPPER(SUBSTRING(MD5(id::text) FROM 1 FOR 5))
WHERE "referralCode" = '' OR "referralCode" IS NULL;

-- Ensure unique index exists (idempotent)
DROP INDEX IF EXISTS "User_referralCode_key";
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
