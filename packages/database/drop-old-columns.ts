import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function dropOldColumns() {
  try {
    // Drop the old providerAccountId column
    await prisma.$executeRawUnsafe(`ALTER TABLE "Account" DROP COLUMN IF EXISTS "providerAccountId";`);
    console.log('✅ Dropped providerAccountId column');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

dropOldColumns();
