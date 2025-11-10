import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addSessionUpdatedAt() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
    console.log('✅ Added updatedAt column to Session table');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addSessionUpdatedAt();
