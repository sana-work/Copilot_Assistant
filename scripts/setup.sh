#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

"$ROOT_DIR/scripts/check-env.sh"

echo "Installing dependencies..."
npm install

echo "Building packages..."
npm run build

echo "Running tests..."
npm test

echo "Checking CLI environment..."
npm run cli -- doctor

echo "Setup complete. Try: npm run cli -- version"
