# 🎮 TicTacToe — Real-Time Multiplayer

A production-ready, real-time multiplayer Tic-Tac-Toe game with **server-authoritative architecture** using Nakama as the game backend infrastructure.

> **Live Demo:** https://tic-tac-toe-two-self-80.vercel.app  
> **Nakama Server:** http://143.110.176.47:7350  
> **Nakama Console:** http://143.110.176.47:7351 (admin / password)

---

## 📋 Table of Contents

1. [Tech Stack](#-tech-stack)
2. [Architecture & Design Decisions](#-architecture--design-decisions)
3. [Project Structure](#-project-structure)
4. [Setup & Installation](#-setup--installation)
5. [Deployment Process](#-deployment-process)
6. [API & Server Configuration](#-api--server-configuration)
7. [How to Test Multiplayer](#-how-to-test-multiplayer)
8. [Features Checklist](#-features-checklist)

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite | UI framework |
| Styling | Tailwind CSS | Responsive design |
| Realtime Client | Nakama JS SDK v2.8.0 | WebSocket + REST |
| Game Backend | Nakama 3.22.0 | Game server |
| Server Runtime | JavaScript (ES5) | Game logic module |
| Database | CockroachDB v23.1 | Persistent storage |
| Backend Hosting | DigitalOcean (2GB RAM) | Cloud server |
| Frontend Hosting | Vercel | Static hosting |
| HTTPS Tunnel | Cloudflare Tunnel | SSL for WebSockets |
| Containerization | Docker + Docker Compose | Service management |

---

## 🏗️ Architecture & Design Decisions

### System Architecture

```
┌──────────────────────────────────────────────────────┐
│           React Frontend (Vercel HTTPS)               │
│                                                       │
│   LoginPage → GamePage → LeaderboardPage              │
│                                                       │
│   Nakama JS SDK                                       │
│   ├── REST API  → Authentication, RPC calls           │
│   └── WebSocket → Real-time game events               │
└─────────────────────┬────────────────────────────────┘
                      │
                      │ HTTPS + WSS
                      │ (via Cloudflare Tunnel)
                      │
┌─────────────────────▼────────────────────────────────┐
│           Nakama Server (DigitalOcean)                │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │           tictactoe.js Runtime Module            │ │
│  │                                                  │ │
│  │  matchInit        → Initialize empty board       │ │
│  │  matchJoinAttempt → Validate join requests       │ │
│  │  matchJoin        → Assign X/O, start game       │ │
│  │  matchLoop        → Check 30s turn timer         │ │
│  │  matchLeave       → Handle disconnections        │ │
│  │  handleMove       → Validate & apply moves       │ │
│  │  rpcFindMatch     → Auto matchmaking             │ │
│  │  rpcGetLeaderboard→ Rankings                     │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────┬────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────┐
│                  CockroachDB                          │
│   Sessions · Leaderboards · Match History             │
└──────────────────────────────────────────────────────┘
```

### Server-Authoritative Design

All game logic runs **exclusively on the Nakama server**. The client only sends player intent — the server validates, applies, and broadcasts results.

**Client only sends:**
```json
{ "position": 4 }
```
*(OpCode 101 — MAKE_MOVE)*

**Server validates every move for:**
- ✅ Game is currently in progress
- ✅ It is this player's turn
- ✅ Position is valid (0–8)
- ✅ Cell is empty
- ✅ Turn timer has not expired (30 seconds)

If any check fails → server sends `MOVE_REJECTED` → board does not change. This prevents all forms of client-side cheating.

### Key Design Decisions

**Why Nakama?**
Built-in matchmaking, WebSocket management, leaderboards, and auth — no reinventing the wheel. Handles N concurrent match sessions with full isolation.

**Why CockroachDB?**
Nakama's default database. Handles session persistence and leaderboard data out of the box. Horizontally scalable.

**Why Device ID Auth?**
Frictionless — no email/password needed. Players start immediately. Device ID persists in localStorage for session continuity.

**Why Cloudflare Tunnel?**
Vercel serves HTTPS. Browsers block mixed content (HTTPS → HTTP). Cloudflare Tunnel provides a free HTTPS+WSS endpoint proxying to Nakama.

**Why Pure ES5 JavaScript for Server Module?**
Nakama's embedded JS engine (goja) has limited ES6+ support. Pure ES5 ensures maximum compatibility — no shorthand properties or spread operators that cause parser panics.

---

## 📁 Project Structure

```
tictactoe/
├── nakama/
│   ├── modules/
│   │   └── tictactoe.js        # Server game logic (pure ES5 JS)
│   ├── docker-compose.yml      # Local dev (Nakama + CockroachDB)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   └── nakama.ts       # Nakama client singleton + types
│   │   ├── hooks/
│   │   │   └── useAuth.tsx     # Authentication context
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx   # Username entry
│   │   │   ├── GamePage.tsx    # Matchmaking + game board
│   │   │   └── LeaderboardPage.tsx
│   │   └── components/
│   │       ├── Board.tsx       # Game grid with animations
│   │       ├── PlayerCard.tsx  # Player info + turn indicator
│   │       ├── TurnTimer.tsx   # 30s countdown timer
│   │       ├── GameOverModal.tsx
│   │       └── Navbar.tsx
│   ├── .env.example
│   └── package.json
├── deployment/
│   └── docker-compose.prod.yml
└── README.md
```

---

## ⚙️ Setup & Installation

### Prerequisites

- Docker Desktop installed and running
- Node.js 18+ and npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/tictactoe.git
cd tictactoe
```

### 2. Start Nakama Backend (Local)

```bash
cd nakama

# Start Nakama + CockroachDB
docker compose up -d

# Wait ~30 seconds then verify
curl http://localhost:7350/ && echo "Nakama is up!"

# Watch logs
docker logs ttt-nakama --tail 20
```

**Nakama Console:** http://localhost:7351  
**Credentials:** `admin` / `password`

### 3. Start Frontend (Local)

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Default values work for local Nakama — no changes needed

# Start dev server
npm run dev
```

**Open:** http://localhost:3000

### Environment Variables

```bash
# Local development (.env.local)
VITE_NAKAMA_HOST=localhost
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_SSL=false
VITE_NAKAMA_SERVER_KEY=defaultkey

# Production
VITE_NAKAMA_HOST=your-tunnel.trycloudflare.com
VITE_NAKAMA_PORT=443
VITE_NAKAMA_SSL=true
VITE_NAKAMA_SERVER_KEY=defaultkey
```

---

## 🚀 Deployment Process

### Backend — DigitalOcean Droplet

**Droplet specs:**
- Ubuntu 22.04 LTS x64
- 2GB RAM / 1 vCPU ($12/mo)
- Region: Bangalore (BLR1)
- IP: `143.110.176.47`

**Step 1 — Initial server setup:**
```bash
ssh root@143.110.176.47

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# Create project directory
mkdir -p /opt/tictactoe/modules
```

**Step 2 — Upload module (from local machine):**
```bash
scp nakama/modules/tictactoe.js root@143.110.176.47:/opt/tictactoe/modules/
scp deployment/docker-compose.prod.yml root@143.110.176.47:/opt/tictactoe/docker-compose.yml
```

**Step 3 — Start services (on server):**
```bash
cd /opt/tictactoe
docker compose up -d

# Verify Nakama is running
curl http://localhost:7350/ && echo "Nakama is up!"
```

**Step 4 — Set up Cloudflare Tunnel (HTTPS):**
```bash
# Install cloudflared
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared.deb

# Create auto-restart systemd service
cat > /etc/systemd/system/cloudflared.service << 'EOF'
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
ExecStart=/usr/bin/cloudflared tunnel --url http://localhost:7350 --no-autoupdate
Restart=always
RestartSec=10
StandardOutput=append:/var/log/cloudflared.log
StandardError=append:/var/log/cloudflared.log

[Install]
WantedBy=multi-user.target
EOF

systemctl enable cloudflared
systemctl start cloudflared

# Get your tunnel URL
cat /var/log/cloudflared.log | grep "trycloudflare.com"
```

### Frontend — Vercel

**Step 1 — Build and deploy:**
```bash
cd frontend
npm run build
npx vercel --prod
```

**Step 2 — Set environment variables on Vercel:**

Go to: **Project → Settings → Environment Variables**

| Variable | Value |
|----------|-------|
| `VITE_NAKAMA_HOST` | `your-tunnel.trycloudflare.com` |
| `VITE_NAKAMA_PORT` | `443` |
| `VITE_NAKAMA_SSL` | `true` |
| `VITE_NAKAMA_SERVER_KEY` | `defaultkey` |

**Step 3 — Connect GitHub for auto-deploy:**

Project → Settings → Git → Connect Repository → select your repo.
Every `git push` to `main` automatically redeploys.

**Step 4 — Verify deployment:**
```bash
# Nakama API responding
curl http://143.110.176.47:7350/

# Module loaded
docker exec ttt-nakama ls /nakama/data/modules/

# Open Nakama console in browser
# http://143.110.176.47:7351
```

---

## 📡 API & Server Configuration

### Nakama Server Flags

| Flag | Value | Description |
|------|-------|-------------|
| `--name` | `nakama1` | Node name |
| `--logger.level` | `WARN` | Log verbosity |
| `--session.token_expiry_sec` | `7200` | Session TTL (2 hours) |
| `--runtime.path` | `/nakama/data/modules` | Module directory |
| `--runtime.js_entrypoint` | `tictactoe.js` | Entry module file |
| `--socket.outgoing_queue_size` | `64` | WebSocket buffer size |

### RPC Endpoints

| RPC ID | Description | Auth Required |
|--------|-------------|---------------|
| `find_match` | Find open match or create new one | Session token |
| `get_leaderboard` | Return top 20 players by wins | Session token |

**Example REST call:**
```bash
curl http://143.110.176.47:7350/v2/rpc/get_leaderboard \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Message Protocol (OpCodes)

**Client → Server:**

| OpCode | Name | Payload |
|--------|------|---------|
| 101 | `MAKE_MOVE` | `{ position: number }` (0–8) |

**Server → Client:**

| OpCode | Name | Payload |
|--------|------|---------|
| 1 | `GAME_STATE` | Full GameState object |
| 2 | `MOVE_ACCEPTED` | — |
| 3 | `MOVE_REJECTED` | `{ reason: string }` |
| 4 | `GAME_OVER` | `GameState + { reason }` |
| 7 | `WAITING_FOR_OPPONENT` | `{ message: string }` |
| 8 | `TURN_TIMEOUT` | Full GameState object |

### GameState Object

```typescript
{
  board: (string | null)[],      // 9 cells: "X" | "O" | null
  currentTurn: string,           // userId of player whose turn it is
  playerX: string,               // userId of X player
  playerO: string,               // userId of O player
  playerXUsername: string,
  playerOUsername: string,
  status: "waiting" | "playing" | "finished",
  winner: string | null,         // userId or "draw"
  winningLine: number[] | null,  // e.g. [0, 1, 2]
  moveCount: number,
  turnStartTime: number,         // Unix timestamp ms
  reason?: string                // "win" | "draw" | "opponent_disconnected" | "timeout"
}
```

---

## 🧪 How to Test Multiplayer

### Option 1 — Two Different Browsers (Recommended)

1. Open **Chrome** at https://tic-tac-toe-two-self-80.vercel.app
2. Open **Firefox** at the same URL
3. Log in as **"Player1"** in Chrome
4. Log in as **"Player2"** in Firefox
5. Click **Find Match** in Chrome → creates a room and waits
6. Click **Find Match** in Firefox → finds the open room and joins
7. Game starts — X goes first
8. Make moves alternately — both browsers update in real time

### Option 2 — Normal + Incognito Window

1. Open a normal browser tab at the game URL
2. Open an Incognito / Private window at the same URL
3. Log in with different usernames in each
4. Click **Find Match** in both — they will be paired automatically

### Option 3 — Two Devices

1. Open the game on your laptop
2. Open the game on your phone
3. Log in with different usernames
4. Click **Find Match** on both devices

### What to Verify

| Test | Expected Result |
|------|----------------|
| Both players see the same board | Real-time sync via WebSocket |
| Only current player can click cells | Turn enforcement server-side |
| Moves appear instantly on both screens | WebSocket broadcast |
| Win/draw detection | Correct result shown to both |
| 30-second timer counts down | Visible on both screens |
| Timer runs out | Turn switches automatically |
| One player closes tab | Other player wins by forfeit |
| Leaderboard after game | Wins/losses updated instantly |

---

## ✅ Features Checklist

### Core Requirements
- [x] Server-authoritative game logic
- [x] Server-side move validation (5 checks per move)
- [x] Prevent client-side manipulation
- [x] Real-time state broadcast via WebSocket
- [x] Auto matchmaking (find or create rooms)
- [x] Game room isolation (concurrent sessions)
- [x] Graceful disconnect handling (forfeit win)
- [x] Responsive UI optimized for mobile
- [x] Player info and match status display
- [x] Deployed Nakama server (DigitalOcean)
- [x] Deployed frontend (Vercel)

### Bonus Features
- [x] **Leaderboard** — global rankings with wins, losses, win rate
- [x] **30-second turn timer** — auto-forfeit on timeout with countdown UI
- [x] **Multiple concurrent games** — full match isolation

---

## 📜 License

MIT
