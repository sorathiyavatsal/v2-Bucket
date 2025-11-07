#!/bin/sh
set -e

echo "Installing Git dependencies..."
apk add --no-cache git openssh-client

if [ ! -d /build/v2-bucket/.git ]; then
  echo "Cloning repository..."
  git clone --depth 1 --branch ${GIT_BRANCH} ${GIT_REPO} /build/v2-bucket
else
  echo "Repository exists, pulling latest..."
  cd /build/v2-bucket
  git pull origin ${GIT_BRANCH}
fi

echo "Build preparation complete"
sleep infinity
