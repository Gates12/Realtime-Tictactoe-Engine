# TicTacToe — Real-time Multiplayer

A production-ready multiplayer Tic-Tac-Toe game with **server-authoritative architecture** using Nakama as the game backend.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Realtime Client | Nakama JS SDK |
| Game Backend | Nakama 3.22 (TypeScript runtime) |
| Database | CockroachDB |
| Deployment | Docker Compose + DigitalOcean |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  Login → Lobby → Game Board → Leaderboard               │
│  Nakama JS SDK (WebSocket + REST)                       │
└────────────────────┬────────────────────────────────────┘
                     │  WebSocket (port 7349)
                     │  REST API  (port 7350)
┌────────────────────▼────────────────────────────────────┐
│                  Nakama Server                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │          TypeScript Runtime Module               │  │
│  │  ┌─────────────┐  ┌───────────┐  ┌──────────┐  │  │
│  │  │ Match Logic  │  │  RPCs     │  │ Leaderbd │  │  │
│  │  │ (server auth)│  │ find_match│  │  global  │  │  │
│  │  └─────────────┘  └───────────┘  └──────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  CockroachDB                             │
│  Sessions · Leaderboards · Match history                │
└─────────────────────────────────────────────────────────┘
```

### Server-Authoritative Design

All game logic runs **exclusively on the Nakama server**. The client only sends:
- `MAKE_MOVE` (opcode 101) — `{ position: 0-8 }`

The server validates every move before applying it. Possible rejection reasons:
- Not your turn
- Cell already occupied
- Invalid position
- Game not in progress

This prevents all forms of client-side cheating.

---

## Project Structure

```
tictactoe/
├── nakama/
│   ├── modules/
│   │   └── tictactoe.ts        # Server game logic (TypeScript)
│   ├── docker-compose.yml      # Local dev (Nakama + CockroachDB)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── lib/nakama.ts       # Nakama client singleton + types
│   │   ├── hooks/
│   │   │   ├── useAuth.tsx     # Auth context
│   │   │   └── useMatch.ts     # Real-time match state
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── LobbyPage.tsx
│   │   │   ├── GamePage.tsx
│   │   │   └── LeaderboardPage.tsx
│   │   └── components/
│   │       ├── Board.tsx
│   │       ├── PlayerCard.tsx
│   │       ├── GameOverModal.tsx
│   │       └── Navbar.tsx
│   ├── .env.example
│   └── package.json
├── deployment/
│   ├── docker-compose.prod.yml
│   └── digitalocean-setup.sh
└── scripts/
    └── build-module.sh
```

---

## Local Development Setup

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- npm

### 1. Start Nakama Backend

```bash
cd nakama

# Install TypeScript dependencies
npm install

# Compile the TypeScript module
npx tsc --build
# Output: nakama/build/tictactoe.js

# Start Nakama + CockroachDB
# Note: docker-compose.yml mounts the modules/ folder
# Copy the compiled JS to modules/ first:
cp build/tictactoe.js modules/

docker compose up -d

# Check it's running
docker compose logs -f nakama
```

Nakama Console → http://localhost:7351  
Default credentials: `admin` / `password`

### 2. Start Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy env config
cp .env.example .env.local
# Edit .env.local — defaults work for local Nakama

# Start dev server
npm run dev
```

Open → http://localhost:3000

### 3. Test Multiplayer

Open two browser tabs (or two different browsers) and:
1. Log in with different usernames
2. Click **Find Match** in both tabs
3. First player creates a room, second player joins it automatically
4. Play the game — moves are validated server-side

---

## Message Protocol

### Client → Server

| OpCode | Name | Payload |
|--------|------|---------|
| 101 | `MAKE_MOVE` | `{ position: number }` (0–8) |

### Server → Client

| OpCode | Name | Payload |
|--------|------|---------|
| 1 | `GAME_STATE` | Full `GameState` object |
| 2 | `MOVE_ACCEPTED` | — |
| 3 | `MOVE_REJECTED` | `{ reason: string }` |
| 4 | `GAME_OVER` | `GameState + { reason: "win" \| "draw" \| "opponent_disconnected" }` |
| 5 | `PLAYER_JOINED` | — |
| 6 | `PLAYER_LEFT` | — |
| 7 | `WAITING_FOR_OPPONENT` | `{ message: string }` |

### GameState Object

```typescript
{
  board: (string | null)[],     // 9 cells: "X" | "O" | null
  currentTurn: string,          // session ID of player whose turn it is
  playerX: string,              // session ID
  playerO: string,              // session ID
  playerXUsername: string,
  playerOUsername: string,
  status: "waiting" | "playing" | "finished",
  winner: string | null,        // session ID or "draw"
  winningLine: number[] | null, // indices of winning cells
  moveCount: number
}
```

---

## Deployment to DigitalOcean

### Step 1 — Create Droplet

- **Image**: Ubuntu 22.04 LTS
- **Size**: Basic · 1 vCPU · 2 GB RAM ($12/mo) minimum
- **Region**: Choose closest to your users
- Enable SSH key auth

### Step 2 — Server Setup

```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP

# Run setup script (installs Docker + UFW)
curl -o setup.sh https://raw.githubusercontent.com/YOUR_REPO/main/deployment/digitalocean-setup.sh
bash setup.sh
```

### Step 3 — Deploy Nakama Module

```bash
# On your local machine — build the TypeScript module
cd nakama
npm install && npx tsc --build

# Upload compiled module and compose file
scp build/tictactoe.js root@YOUR_DROPLET_IP:/opt/tictactoe/modules/
scp deployment/docker-compose.prod.yml root@YOUR_DROPLET_IP:/opt/tictactoe/docker-compose.yml

# SSH in and start services
ssh root@YOUR_DROPLET_IP
cd /opt/tictactoe
docker compose up -d

# Watch logs
docker compose logs -f nakama
```

### Step 4 — Deploy Frontend

The frontend is a static build — deploy to Vercel or Netlify.

```bash
cd frontend

# Set production env vars
cp .env.example .env.production.local
# Edit: set VITE_NAKAMA_HOST=YOUR_DROPLET_IP

# Build
npm run build

# Deploy to Vercel
npx vercel --prod

# OR deploy to Netlify
npx netlify deploy --prod --dir=dist
```

### Step 5 — Verify Deployment

```bash
# Check Nakama is responding
curl http://YOUR_DROPLET_IP:7350/

# Check module loaded
docker exec ttt-nakama sh -c "ls /nakama/data/modules/"

# View Nakama console
# Open http://YOUR_DROPLET_IP:7351 in browser
```

---

## RPC Endpoints

| RPC | Method | Description |
|-----|--------|-------------|
| `find_match` | GET | Finds open match or creates new one |
| `get_leaderboard` | GET | Returns top 20 players by wins |

Call via REST:
```
GET http://YOUR_IP:7350/v2/rpc/find_match
Authorization: Bearer YOUR_SESSION_TOKEN
```

---

## Leaderboard

The global leaderboard tracks:
- **Wins** — incremented on win or opponent disconnect
- **Losses** — incremented on loss
- **Win Rate** — calculated client-side as `wins / (wins + losses) * 100`

Stored in two Nakama leaderboards:
- `global_wins` — sorted descending by score
- `global_losses` — sorted descending by score

---

## Design Decisions

### Why server-authoritative?
All game state lives on the server. Clients only send intent (move position). The server validates, applies, and broadcasts. Prevents all client-side cheating.

### Why Nakama?
- Built-in matchmaking, real-time sockets, leaderboards, auth — no reinventing the wheel
- TypeScript runtime means type-safe game logic
- Battle-tested in production games

### Why CockroachDB?
Nakama's default database. Scales horizontally, handles session and leaderboard persistence out of the box.

### Why device ID auth?
Frictionless — no email/password needed to play. Device ID is stored in localStorage for session persistence.
