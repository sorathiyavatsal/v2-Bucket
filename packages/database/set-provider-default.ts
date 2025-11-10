import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setDefault() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Account" ALTER COLUMN "provider" SET DEFAULT 'credential';`);
    console.log('✅ Set default value for provider column');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setDefault();
