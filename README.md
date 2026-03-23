# 🎮 TicTacToe — Real-Time Multiplayer

> Built something fun over the past few weeks — a real-time multiplayer Tic-Tac-Toe game that you can play with anyone, anywhere.
>
> The idea was simple. Sometimes you just want to kill a few minutes — waiting for a meeting to start, sitting in a long queue, or just taking a break from work. Most games need you to download an app or create an account. This one you just open in your browser, type a username, and you are in.
>
> You can either get matched with a random player instantly or send a private room link to a friend and play together. If no one is around, a bot joins automatically after 15 seconds so you are never just staring at a waiting screen.

A production-ready, real-time multiplayer Tic-Tac-Toe game with **server-authoritative architecture** using Nakama as the game backend infrastructure. Supports human vs human matchmaking and **solo play against a bot**.

**Live Demo:** https://www.tic-tac-toe.space  
**Nakama Server:** http://143.110.176.47:7350  
**Nakama Console:** http://143.110.176.47:7351 (admin / password)

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
│  │  matchLoop        → Turn timer + bot AI logic    │ │
│  │  matchLeave       → Handle disconnections        │ │
│  │  handleMove       → Validate & apply moves       │ │
│  │  executeBotMove   → Bot AI move execution        │ │
│  │  rpcFindMatch     → Auto matchmaking             │ │
│  │  rpcCreatePrivateRoom → Private room creation    │ │
│  │  rpcJoinByCode    → Join via room code           │ │
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

All game logic runs **exclusively on the Nakama server**. The client only sends player intent — the server validates, applies, and broadcasts results. This applies to both human and bot moves.

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

If any check fails → server sends `MOVE_REJECTED` → board does not change.

### Bot System

When a player uses **Find Match** and no human opponent joins within **15 seconds**, the server automatically spawns a bot as Player O.

**Bot behavior:**
- Waits **2 seconds** before each move (feels natural, not instant)
- Uses **medium difficulty AI**: win if possible → block opponent's win → take center → take a corner → random empty cell
- Bot games are **excluded from the leaderboard** to keep rankings clean
- Bot only joins **public matchmaking** — private rooms are never assigned a bot
- The game state includes `isBot: true` so the frontend can display a 🤖 indicator

**Bot is entirely server-side** — no client changes required. The same WebSocket protocol is used; the bot just generates moves inside `matchLoop`.

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

**Why Room Codes?**
Allows friends to play together privately without random matchmaking. A 6-character alphanumeric code is generated server-side and stored in the match label for lookup.

**Why server-side bot AI?**
Keeps the architecture fully server-authoritative. The bot runs inside `matchLoop` just like any other game logic — the client has no knowledge of or control over bot behavior.

---

## 📁 Project Structure

```
tictactoe/
├── nakama/
│   ├── modules/
│   │   └── tictactoe.js        # Server game logic + bot AI (pure ES5 JS)
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
git clone https://github.com/Gates12/Realtime-Tictactoe-Engine.git
cd Realtime-Tictactoe-Engine
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

**Step 5 — Update server module after changes:**
```bash
# From local machine
scp nakama/modules/tictactoe.js root@143.110.176.47:/opt/tictactoe/modules/

# Restart Nakama (check your service name first with: docker compose ps)
ssh root@143.110.176.47 "cd /opt/tictactoe && docker compose restart nakama"
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

**Step 3 — Set Root Directory on Vercel:**

Go to: **Project → Settings → General → Root Directory**  
Set to: `frontend`

**Step 4 — Connect GitHub for auto-deploy:**

Project → Settings → Git → Connect Repository → select your repo.  
Every `git push` to `main` automatically redeploys.

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
| `find_match` | Find open public match or create new one | Session token |
| `create_private_room` | Create a private room with a 6-letter code | Session token |
| `join_by_code` | Join a private room using its code | Session token |
| `get_leaderboard` | Return top 20 players by wins | Session token |

**Example REST calls:**
```bash
# Get leaderboard
curl http://143.110.176.47:7350/v2/rpc/get_leaderboard \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Join by room code
curl http://143.110.176.47:7350/v2/rpc/join_by_code \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{"code":"ABC123"}'
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
  playerOUsername: string,       // "🤖 Bot" when playing vs bot
  status: "waiting" | "playing" | "finished",
  winner: string | null,         // userId or "draw"
  winningLine: number[] | null,  // e.g. [0, 1, 2]
  moveCount: number,
  turnStartTime: number,         // Unix timestamp ms
  roomCode: string | null,       // 6-letter code for private rooms
  isBot: boolean,                // true when opponent is the bot
  reason?: string                // "win" | "draw" | "opponent_disconnected" | "timeout"
}
```

---

## 🧪 How to Test Multiplayer

### Option 1 — Quick Match (Two Different Browsers)

1. Open **Chrome** at https://tic-tac-toe-two-self-80.vercel.app
2. Open **Firefox** at the same URL
3. Log in with different usernames in each
4. Click **⚡ Find Match** in both browsers
5. Game starts automatically — X goes first

### Option 2 — Play vs Bot (Solo)

1. Open the game and log in
2. Click **⚡ Find Match**
3. Wait **15 seconds** — if no human joins, a 🤖 Bot joins automatically
4. Play as normal — the bot responds within ~2 seconds per move
5. Bot games do **not** affect your leaderboard stats

### Option 3 — Private Room with Code

1. Open **Chrome** → log in → click **🔒 Create Private Room**
2. A **6-letter room code** appears (e.g. `XK9F2A`)
3. Open **Firefox** → log in → enter the code → click **Join**
4. Game starts immediately *(bot never joins private rooms)*

### Option 4 — Invite Link

1. Create a Private Room in Chrome
2. Click **📋 Copy Invite Link**
3. Paste the link in Firefox or send to a friend
4. Friend opens the link → auto-joins the room instantly

### Option 5 — Two Devices

1. Open the game on your laptop and phone
2. Log in with different usernames
3. Use Quick Match or share a room code

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
| Room code join | Second player joins correct room |
| Invite link | Auto-joins room from URL |
| No opponent after 15s | Bot joins automatically |
| Bot makes moves | Responds within ~2 seconds |
| Bot game ends | Leaderboard unchanged |
| Mobile layout | Responsive on phone screen |

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
- [x] **Bot opponent** — auto-joins after 15s if no human found; medium difficulty AI (win → block → center → corner → random); runs entirely server-side
- [x] **Leaderboard** — global rankings with wins, losses, win rate (bot games excluded)
- [x] **30-second turn timer** — auto-forfeit on timeout with countdown UI
- [x] **Multiple concurrent games** — full match isolation
- [x] **Private Room Codes** — 6-letter codes to play with friends
- [x] **Invite Links** — shareable URLs that auto-join a room
- [x] **Mobile Responsive** — optimized for phones and tablets
