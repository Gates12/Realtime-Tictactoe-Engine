#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# TicTacToe — DigitalOcean Droplet Setup Script
# Run this once on a fresh Ubuntu 22.04 droplet (1 vCPU / 2GB RAM minimum)
# Usage: bash digitalocean-setup.sh
# ──────────────────────────────────────────────────────────────────────────────

set -e

echo "━━━ [1/6] Updating system packages..."
apt-get update -y && apt-get upgrade -y

echo "━━━ [2/6] Installing Docker..."
apt-get install -y ca-certificates curl gnupg lsb-release

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

echo "━━━ [3/6] Configuring firewall (UFW)..."
ufw allow OpenSSH
ufw allow 7349/tcp   # Nakama real-time
ufw allow 7350/tcp   # Nakama API
# Port 7351 (console) left closed — access via SSH tunnel only
ufw --force enable

echo "━━━ [4/6] Creating project directory..."
mkdir -p /opt/tictactoe/modules
cd /opt/tictactoe

echo "━━━ [5/6] Copying production compose file..."
# This script assumes you've already scp'd the files — see README deploy section
echo "→ Please scp your files if you haven't already:"
echo "  scp -r ./nakama/modules/* root@YOUR_IP:/opt/tictactoe/modules/"
echo "  scp ./deployment/docker-compose.prod.yml root@YOUR_IP:/opt/tictactoe/docker-compose.yml"

echo "━━━ [6/6] Setup complete!"
echo ""
echo "Next steps:"
echo "  1. scp your compiled .js module to /opt/tictactoe/modules/"
echo "  2. cd /opt/tictactoe && docker compose up -d"
echo "  3. Check logs: docker compose logs -f nakama"
echo ""
echo "Nakama Console: http://YOUR_DROPLET_IP:7351"
echo "  Default credentials: admin / password"
echo "  ⚠ Change console password immediately in production!"
