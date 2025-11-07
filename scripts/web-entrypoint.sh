#!/bin/sh
set -e

echo "Installing dependencies..."
apk add --no-cache dumb-init
npm install -g pnpm@9

echo "Copying source code..."
cp -r /build/v2-bucket/* /app/

echo "Installing packages (with dev dependencies for build)..."
cd /app
NODE_ENV=development pnpm install --frozen-lockfile

echo "Generating Prisma client..."
cd /app/packages/database
pnpm exec prisma generate

echo "Building Web UI..."
cd /app/apps/web
pnpm build

echo "Starting Web UI..."
exec dumb-init node .next/standalone/apps/web/server.js
