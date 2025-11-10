// Load environment variables FIRST before any other imports
// This must be imported at the very top of index.ts
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from monorepo root
// Try multiple paths to handle both development (tsx) and production (compiled) scenarios
const envPaths = [
  resolve(__dirname, '../../../.env'),           // From src/lib (development with tsx)
  resolve(__dirname, '../../../../.env'),        // From dist/lib (production)
  resolve(process.cwd(), '.env'),                // From working directory (apps/api)
  resolve(process.cwd(), '../../.env'),          // From working directory up 2 levels
];

console.log('🔍 Loading environment variables...');
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);

let envLoaded = false;
for (const envPath of envPaths) {
  const exists = existsSync(envPath);
  console.log(`Trying: ${envPath} - ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);

  if (exists) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`✅ Environment loaded from: ${envPath}`);
      console.log(`✅ DATABASE_URL is ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
      envLoaded = true;
      break;
    } else {
      console.log(`❌ Error loading ${envPath}:`, result.error.message);
    }
  }
}

if (!envLoaded) {
  console.warn('⚠️  No .env file found, using system environment variables');
  console.warn(`⚠️  DATABASE_URL from system: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
}

export const envVariablesLoaded = envLoaded;
