// Tic-Tac-Toe Nakama Server-Authoritative Match Handler
// All game logic runs here — clients cannot manipulate state

const MODULE_NAME = "tictactoe";
const TICK_RATE = 1;
const MAX_PLAYERS = 2;

// Opcodes for client <-> server messages
const OpCode = {
  // Server -> Client
  GAME_STATE: 1,
  MOVE_ACCEPTED: 2,
  MOVE_REJECTED: 3,
  GAME_OVER: 4,
  PLAYER_JOINED: 5,
  PLAYER_LEFT: 6,
  WAITING_FOR_OPPONENT: 7,
  // Client -> Server
  MAKE_MOVE: 101,
} as const;

interface GameState {
  board: (string | null)[];
  currentTurn: string;
  playerX: string;
  playerO: string;
  playerXUsername: string;
  playerOUsername: string;
  status: "waiting" | "playing" | "finished";
  winner: string | null;
  winningLine: number[] | null;
  moveCount: number;
}

// All possible winning lines
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: (string | null)[]): { winner: string | null; line: number[] | null } {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a]!, line };
    }
  }
  return { winner: null, line: null };
}

function isBoardFull(board: (string | null)[]): boolean {
  return board.every(cell => cell !== null);
}

function updateLeaderboard(nk: nkruntime.Nakama, winnerUserId: string, winnerUsername: string, loserUserId: string, loserUsername: string): void {
  try {
    nk.leaderboardRecordWrite("global_wins", winnerUserId, winnerUsername, 1, 0, {});
    nk.leaderboardRecordWrite("global_losses", loserUserId, loserUsername, 1, 0, {});
  } catch (e) {
    // leaderboards created in InitModule
  }
}

// ── Match Handlers ─────────────────────────────────────

const matchInit: nkruntime.MatchInitFunction = function (ctx, logger, nk, params) {
  const state: GameState = {
    board: Array(9).fill(null),
    currentTurn: "",
    playerX: "",
    playerO: "",
    playerXUsername: "",
    playerOUsername: "",
    status: "waiting",
    winner: null,
    winningLine: null,
    moveCount: 0,
  };
  logger.info("Match initialized: %s", ctx.matchId);
  return { state, tickRate: TICK_RATE, label: JSON.stringify({ open: 1 }) };
};

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  const gs = state as GameState;
  if (gs.status === "finished") return { state, accept: false, rejectMessage: "Match already finished" };
  const playerCount = [gs.playerX, gs.playerO].filter(Boolean).length;
  if (playerCount >= MAX_PLAYERS) return { state, accept: false, rejectMessage: "Match is full" };
  return { state, accept: true };
};

const matchJoin: nkruntime.MatchJoinFunction = function (ctx, logger, nk, dispatcher, tick, state, presences) {
  const gs = state as GameState;

  for (const p of presences) {
    if (!gs.playerX) {
      gs.playerX = p.sessionId;
      gs.playerXUsername = p.username;
      logger.info("Player X: %s", p.username);
    } else if (!gs.playerO) {
      gs.playerO = p.sessionId;
      gs.playerOUsername = p.username;
      logger.info("Player O: %s", p.username);
    }
  }

  if (gs.playerX && gs.playerO && gs.status === "waiting") {
    gs.status = "playing";
    gs.currentTurn = gs.playerX;
    dispatcher.matchLabelUpdate(JSON.stringify({ open: 0 }));
    dispatcher.broadcastMessage(OpCode.GAME_STATE, JSON.stringify(gs), null, null, true);
    logger.info("Game started!");
  } else if (gs.status === "waiting") {
    dispatcher.broadcastMessage(
      OpCode.WAITING_FOR_OPPONENT,
      JSON.stringify({ message: "Waiting for opponent..." }),
      presences, null, true
    );
  }

  return { state: gs };
};

const matchLeave: nkruntime.MatchLeaveFunction = function (ctx, logger, nk, dispatcher, tick, state, presences) {
  const gs = state as GameState;

  for (const p of presences) {
    logger.info("Player left: %s", p.username);
    if (gs.status === "playing") {
      const winnerSessionId = p.sessionId === gs.playerX ? gs.playerO : gs.playerX;
      const winnerUserId = winnerSessionId === gs.playerX ? gs.playerX : gs.playerO;
      const winnerUsername = winnerSessionId === gs.playerX ? gs.playerXUsername : gs.playerOUsername;

      gs.status = "finished";
      gs.winner = winnerSessionId;

      dispatcher.broadcastMessage(
        OpCode.GAME_OVER,
        JSON.stringify({ ...gs, reason: "opponent_disconnected" }),
        null, null, true
      );

      updateLeaderboard(nk, winnerUserId, winnerUsername, p.userId, p.username);
    }
  }

  return { state: gs };
};

const matchLoop: nkruntime.MatchLoopFunction = function (ctx, logger, nk, dispatcher, tick, state, messages) {
  const gs = state as GameState;

  if (gs.status === "finished") return null;

  for (const message of messages) {
    if (message.opCode === OpCode.MAKE_MOVE) {
      handleMove(logger, nk, dispatcher, gs, message);
    }
  }

  return { state: gs };
};

function handleMove(
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  gs: GameState,
  message: nkruntime.MatchMessage
): void {
  const reject = (reason: string) => {
    dispatcher.broadcastMessage(OpCode.MOVE_REJECTED, JSON.stringify({ reason }), [message.sender], null, true);
  };

  if (gs.status !== "playing") return reject("Game not in progress");
  if (message.sender.sessionId !== gs.currentTurn) return reject("Not your turn");

  let moveData: { position: number };
  try {
    moveData = JSON.parse(nk.binaryToString(message.data));
  } catch (e) {
    return reject("Invalid message format");
  }

  const { position } = moveData;
  if (!Number.isInteger(position) || position < 0 || position > 8) return reject("Invalid position");
  if (gs.board[position] !== null) return reject("Cell already occupied");

  // Apply move
  const symbol = message.sender.sessionId === gs.playerX ? "X" : "O";
  gs.board[position] = symbol;
  gs.moveCount++;

  logger.info("Move: %s at %d", symbol, position);

  // Check win
  const { winner: winSymbol, line } = checkWinner(gs.board);
  if (winSymbol) {
    const isXWin = winSymbol === "X";
    const winnerSessionId = isXWin ? gs.playerX : gs.playerO;
    const loserSessionId = isXWin ? gs.playerO : gs.playerX;
    const winnerUsername = isXWin ? gs.playerXUsername : gs.playerOUsername;
    const loserUsername = isXWin ? gs.playerOUsername : gs.playerXUsername;

    gs.status = "finished";
    gs.winner = winnerSessionId;
    gs.winningLine = line;

    dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({ ...gs, reason: "win" }), null, null, true);
    updateLeaderboard(nk, winnerSessionId, winnerUsername, loserSessionId, loserUsername);
    return;
  }

  if (isBoardFull(gs.board)) {
    gs.status = "finished";
    gs.winner = "draw";
    dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({ ...gs, reason: "draw" }), null, null, true);
    return;
  }

  // Switch turn
  gs.currentTurn = gs.currentTurn === gs.playerX ? gs.playerO : gs.playerX;
  dispatcher.broadcastMessage(OpCode.GAME_STATE, JSON.stringify(gs), null, null, true);
}

const matchTerminate: nkruntime.MatchTerminateFunction = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  return { state };
};

const matchSignal: nkruntime.MatchSignalFunction = function (ctx, logger, nk, dispatcher, tick, state, data) {
  return { state };
};

// ── RPC Functions ─────────────────────────────────────

const rpcFindMatch: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  const matches = nk.matchList(10, true, null, 0, 1, '{"open":1}');
  if (matches && matches.length > 0) {
    logger.info("Found open match: %s", matches[0].matchId);
    return JSON.stringify({ matchId: matches[0].matchId });
  }
  const matchId = nk.matchCreate(MODULE_NAME, {});
  logger.info("Created new match: %s", matchId);
  return JSON.stringify({ matchId });
};

const rpcGetLeaderboard: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  try {
    const wins = nk.leaderboardRecordsList("global_wins", [], 20, undefined, undefined);
    const losses = nk.leaderboardRecordsList("global_losses", [], 20, undefined, undefined);

    const stats: Record<string, { username: string; wins: number; losses: number }> = {};

    for (const r of (wins.records || [])) {
      stats[r.ownerId] = { username: r.username || r.ownerId, wins: Number(r.score), losses: 0 };
    }
    for (const r of (losses.records || [])) {
      if (stats[r.ownerId]) {
        stats[r.ownerId].losses = Number(r.score);
      } else {
        stats[r.ownerId] = { username: r.username || r.ownerId, wins: 0, losses: Number(r.score) };
      }
    }

    const leaderboard = Object.entries(stats)
      .map(([userId, d]) => ({
        userId,
        username: d.username,
        wins: d.wins,
        losses: d.losses,
        winRate: d.wins + d.losses > 0 ? Math.round((d.wins / (d.wins + d.losses)) * 100) : 0,
      }))
      .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)
      .slice(0, 20);

    return JSON.stringify({ leaderboard });
  } catch (e) {
    logger.error("Leaderboard error: %v", e);
    return JSON.stringify({ leaderboard: [] });
  }
};

// ── InitModule ─────────────────────────────────────────

function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer): void {
  try {
    nk.leaderboardCreate("global_wins", false, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.INCREMENTAL, undefined, {});
    nk.leaderboardCreate("global_losses", false, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.INCREMENTAL, undefined, {});
  } catch (e) {
    logger.warn("Leaderboards may already exist");
  }

  initializer.registerMatch(MODULE_NAME, {
    matchInit, matchJoinAttempt, matchJoin, matchLeave, matchLoop, matchTerminate, matchSignal,
  });

  initializer.registerRpc("find_match", rpcFindMatch);
  initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);

  logger.info("Tic-Tac-Toe module loaded ✓");
}
