#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from monorepo root
const envPath = resolve(__dirname, '../../../.env');
config({ path: envPath });

// Get prisma command from arguments
const prismaCommand = process.argv.slice(2);

if (prismaCommand.length === 0) {
  console.error('Error: No Prisma command specified');
  process.exit(1);
}

// Run prisma command
const prisma = spawn('prisma', prismaCommand, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

prisma.on('exit', (code) => {
  process.exit(code || 0);
});
