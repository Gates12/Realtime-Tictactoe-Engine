#!/bin/bash
# Builds the TypeScript Nakama module and copies output to deployment location
# Run from the project root: bash scripts/build-module.sh

set -e

NAKAMA_DIR="./nakama"
OUTPUT_DIR="./nakama/build"

echo "━━━ Building Nakama TypeScript module..."
cd "$NAKAMA_DIR"

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "→ Installing dependencies..."
  npm install
fi

# Compile TypeScript
echo "→ Compiling TypeScript..."
npx tsc --build

echo "✓ Build complete. Output in $OUTPUT_DIR/"
echo ""
echo "To deploy to DigitalOcean:"
echo "  scp $OUTPUT_DIR/tictactoe.js root@YOUR_IP:/opt/tictactoe/modules/"
echo "  ssh root@YOUR_IP 'cd /opt/tictactoe && docker compose restart nakama'"
