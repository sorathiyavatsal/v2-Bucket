-- Migration: Add Better Auth fields to Account table
-- This migration adds the required fields for Better Auth v1.3.34

-- Add new columns to Account table
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "providerId" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "password" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update existing rows to populate new fields from old ones
UPDATE "Account" SET
  "accountId" = "providerAccountId",
  "providerId" = "provider"
WHERE "accountId" IS NULL OR "providerId" IS NULL;

-- Drop the old unique constraint
ALTER TABLE "Account" DROP CONSTRAINT IF NOT EXISTS "Account_provider_providerAccountId_key";

-- Create new unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- Make the new columns required (NOT NULL)
ALTER TABLE "Account" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "Account" ALTER COLUMN "providerId" SET NOT NULL;
