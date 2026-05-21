#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

echo "Checking Copilot Architect environment..."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node.js 20.11 or newer."
  exit 1
fi

node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major < 20 || (major === 20 && minor < 11)) { console.error('Node.js 20.11 or newer is required. Current: ' + process.version); process.exit(1); }"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required for the MVP setup."
  exit 1
fi

echo "Node: $(node -v)"
echo "npm: $(npm -v)"
echo "Environment check passed."
