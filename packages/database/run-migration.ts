// Run database migration for Better Auth Account table
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('Running Account table migration...');

  try {
    // Add new columns
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "providerId" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "password" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);

    console.log('✅ New columns added');

    // Update existing rows
    await prisma.$executeRawUnsafe(`
      UPDATE "Account" SET
        "accountId" = COALESCE("accountId", "providerAccountId"),
        "providerId" = COALESCE("providerId", "provider")
      WHERE "accountId" IS NULL OR "providerId" IS NULL;
    `);

    console.log('✅ Existing rows updated');

    // Drop old constraint
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_provider_providerAccountId_key";
    `);

    console.log('✅ Old constraint dropped');

    // Create new unique index
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");
    `);

    console.log('✅ New unique index created');

    // Make columns NOT NULL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Account" ALTER COLUMN "accountId" SET NOT NULL;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Account" ALTER COLUMN "providerId" SET NOT NULL;
    `);

    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
