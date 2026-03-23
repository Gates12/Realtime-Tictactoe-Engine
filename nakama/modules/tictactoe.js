var MODULE_NAME = "tictactoe";
var TICK_RATE = 1;
var MAX_PLAYERS = 2;
var TURN_TIME_LIMIT = 30000;
var BOT_WAIT_TICKS = 15;   // seconds before bot joins if no human opponent
var BOT_MOVE_DELAY = 2;    // seconds bot "thinks" before making a move
var BOT_USER_ID = "bot-player-001";
var BOT_USERNAME = "🤖 Bot";

var OpCode = {
    GAME_STATE: 1,
    MOVE_ACCEPTED: 2,
    MOVE_REJECTED: 3,
    GAME_OVER: 4,
    PLAYER_JOINED: 5,
    PLAYER_LEFT: 6,
    WAITING_FOR_OPPONENT: 7,
    TURN_TIMEOUT: 8,
    MAKE_MOVE: 101
};

var WIN_LINES = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
];

function checkWinner(board) {
    for (var i = 0; i < WIN_LINES.length; i++) {
        var a = WIN_LINES[i][0], b = WIN_LINES[i][1], c = WIN_LINES[i][2];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], line: WIN_LINES[i] };
        }
    }
    return { winner: null, line: null };
}

function isBoardFull(board) {
    for (var i = 0; i < board.length; i++) {
        if (board[i] === null) return false;
    }
    return true;
}

// ── Bot AI (medium difficulty) ────────────────────────

function findWinningMove(board, symbol) {
    for (var i = 0; i < WIN_LINES.length; i++) {
        var line = WIN_LINES[i];
        var a = board[line[0]], b = board[line[1]], c = board[line[2]];
        var cells = [a, b, c];
        var symCount = 0, nullIdx = -1;
        for (var j = 0; j < 3; j++) {
            if (cells[j] === symbol) symCount++;
            else if (cells[j] === null) nullIdx = j;
        }
        if (symCount === 2 && nullIdx !== -1) {
            return line[nullIdx];
        }
    }
    return -1;
}

function makeBotMove(board, botSymbol, opponentSymbol) {
    // 1. Win if possible
    var win = findWinningMove(board, botSymbol);
    if (win !== -1) return win;

    // 2. Block opponent's winning move
    var block = findWinningMove(board, opponentSymbol);
    if (block !== -1) return block;

    // 3. Take center
    if (board[4] === null) return 4;

    // 4. Take a corner
    var corners = [0, 2, 6, 8];
    var freeCorners = [];
    for (var i = 0; i < corners.length; i++) {
        if (board[corners[i]] === null) freeCorners.push(corners[i]);
    }
    if (freeCorners.length > 0) {
        return freeCorners[Math.floor(Math.random() * freeCorners.length)];
    }

    // 5. Take any empty cell
    var empty = [];
    for (var i = 0; i < 9; i++) {
        if (board[i] === null) empty.push(i);
    }
    if (empty.length > 0) {
        return empty[Math.floor(Math.random() * empty.length)];
    }

    return -1;
}

// ── Leaderboard & Helpers ─────────────────────────────

function updateLeaderboard(nk, winnerUserId, winnerUsername, loserUserId, loserUsername) {
    // Don't record leaderboard entries for bot games
    if (winnerUserId === BOT_USER_ID || loserUserId === BOT_USER_ID) return;
    try {
        nk.leaderboardRecordWrite("global_wins", winnerUserId, winnerUsername, 1, 0, {});
        nk.leaderboardRecordWrite("global_losses", loserUserId, loserUsername, 1, 0, {});
    } catch (e) {}
}

function buildPayload(gs, reason) {
    return JSON.stringify({
        board: gs.board,
        currentTurn: gs.currentTurn,
        playerX: gs.playerX,
        playerO: gs.playerO,
        playerXUsername: gs.playerXUsername,
        playerOUsername: gs.playerOUsername,
        status: gs.status,
        winner: gs.winner,
        winningLine: gs.winningLine,
        moveCount: gs.moveCount,
        turnStartTime: gs.turnStartTime,
        roomCode: gs.roomCode,
        reason: reason || null,
        isBot: gs.isBot || false
    });
}

function handleMove(logger, nk, dispatcher, gs, message) {
    function reject(reason) {
        dispatcher.broadcastMessage(OpCode.MOVE_REJECTED, JSON.stringify({ reason: reason }), [message.sender], null, true);
    }
    if (gs.status !== "playing") { reject("Game not in progress"); return; }
    if (message.sender.userId !== gs.currentTurn) { reject("Not your turn"); return; }
    var moveData;
    try {
        moveData = JSON.parse(nk.binaryToString(message.data));
    } catch (e) { reject("Invalid message format"); return; }
    var position = moveData.position;
    if (position === undefined || position < 0 || position > 8) { reject("Invalid position"); return; }
    if (gs.board[position] !== null) { reject("Cell already occupied"); return; }

    var symbol = message.sender.userId === gs.playerX ? "X" : "O";
    gs.board[position] = symbol;
    gs.moveCount++;
    logger.info("Move: %s at %d", symbol, position);

    var result = checkWinner(gs.board);
    if (result.winner) {
        var isXWin = result.winner === "X";
        var winnerUserId = isXWin ? gs.playerX : gs.playerO;
        var loserUserId = isXWin ? gs.playerO : gs.playerX;
        var winnerUsername = isXWin ? gs.playerXUsername : gs.playerOUsername;
        var loserUsername = isXWin ? gs.playerOUsername : gs.playerXUsername;
        gs.status = "finished";
        gs.winner = winnerUserId;
        gs.winningLine = result.line;
        dispatcher.broadcastMessage(OpCode.GAME_OVER, buildPayload(gs, "win"), null, null, true);
        updateLeaderboard(nk, winnerUserId, winnerUsername, loserUserId, loserUsername);
        return;
    }
    if (isBoardFull(gs.board)) {
        gs.status = "finished";
        gs.winner = "draw";
        dispatcher.broadcastMessage(OpCode.GAME_OVER, buildPayload(gs, "draw"), null, null, true);
        return;
    }

    gs.currentTurn = gs.currentTurn === gs.playerX ? gs.playerO : gs.playerX;
    gs.turnStartTime = Date.now();

    // If it's now the bot's turn, schedule the bot move
    if (gs.isBot && gs.currentTurn === BOT_USER_ID) {
        gs.botMoveScheduledAt = Date.now();
    }

    dispatcher.broadcastMessage(OpCode.GAME_STATE, buildPayload(gs, null), null, null, true);
}

// ── Bot Move Execution ────────────────────────────────

function executeBotMove(logger, nk, dispatcher, gs) {
    var botSymbol = gs.playerO === BOT_USER_ID ? "O" : "X";
    var opponentSymbol = botSymbol === "O" ? "X" : "O";
    var position = makeBotMove(gs.board, botSymbol, opponentSymbol);

    if (position === -1) return; // no moves left (shouldn't happen)

    gs.board[position] = botSymbol;
    gs.moveCount++;
    logger.info("Bot move: %s at %d", botSymbol, position);

    var result = checkWinner(gs.board);
    if (result.winner) {
        var botWon = result.winner === botSymbol;
        var winnerUserId = botWon ? BOT_USER_ID : (gs.playerX === BOT_USER_ID ? gs.playerO : gs.playerX);
        var loserUserId = botWon ? (gs.playerX === BOT_USER_ID ? gs.playerO : gs.playerX) : BOT_USER_ID;
        var winnerUsername = botWon ? BOT_USERNAME : (gs.playerX === BOT_USER_ID ? gs.playerOUsername : gs.playerXUsername);
        var loserUsername = botWon ? (gs.playerX === BOT_USER_ID ? gs.playerOUsername : gs.playerXUsername) : BOT_USERNAME;
        gs.status = "finished";
        gs.winner = winnerUserId;
        gs.winningLine = result.line;
        dispatcher.broadcastMessage(OpCode.GAME_OVER, buildPayload(gs, "win"), null, null, true);
        updateLeaderboard(nk, winnerUserId, winnerUsername, loserUserId, loserUsername);
        return;
    }
    if (isBoardFull(gs.board)) {
        gs.status = "finished";
        gs.winner = "draw";
        dispatcher.broadcastMessage(OpCode.GAME_OVER, buildPayload(gs, "draw"), null, null, true);
        return;
    }

    // Switch back to human
    gs.currentTurn = gs.playerX === BOT_USER_ID ? gs.playerO : gs.playerX;
    gs.turnStartTime = Date.now();
    gs.botMoveScheduledAt = 0;
    dispatcher.broadcastMessage(OpCode.GAME_STATE, buildPayload(gs, null), null, null, true);
}

// ── Match Handlers ────────────────────────────────────

function matchInit(ctx, logger, nk, params) {
    var roomCode = (params && params.code) ? params.code : null;
    var state = {
        board: [null,null,null,null,null,null,null,null,null],
        currentTurn: "",
        playerX: "",
        playerO: "",
        playerXUsername: "",
        playerOUsername: "",
        status: "waiting",
        winner: null,
        winningLine: null,
        moveCount: 0,
        turnStartTime: 0,
        roomCode: roomCode,
        // Bot fields
        isBot: false,
        botMoveScheduledAt: 0,
        waitingTicks: 0,       // counts ticks since first player joined
        isPrivate: roomCode ? true : false
    };
    var label = { open: 1 };
    if (roomCode) label.code = roomCode;
    logger.info("Match initialized: %s code: %s", ctx.matchId, roomCode || "none");
    return { state: state, tickRate: TICK_RATE, label: JSON.stringify(label) };
}

function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    var gs = state;
    if (gs.status === "finished") return { state: state, accept: false, rejectMessage: "Match already finished" };
    var count = (gs.playerX ? 1 : 0) + (gs.playerO ? 1 : 0);
    // Allow bot slot (bot is not a real presence)
    if (count >= MAX_PLAYERS && !gs.isBot) return { state: state, accept: false, rejectMessage: "Match is full" };
    // If bot already joined, only allow if it's replacing the bot (second human wants to join a bot game — not supported)
    if (gs.isBot && gs.playerO === BOT_USER_ID) return { state: state, accept: false, rejectMessage: "Playing with bot" };
    return { state: state, accept: true };
}

function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
    var gs = state;
    for (var i = 0; i < presences.length; i++) {
        var p = presences[i];
        if (!gs.playerX) {
            gs.playerX = p.userId;
            gs.playerXUsername = p.username;
            gs.waitingTicks = 0; // start counting
            logger.info("Player X: %s", p.username);
        } else if (!gs.playerO) {
            gs.playerO = p.userId;
            gs.playerOUsername = p.username;
            logger.info("Player O: %s", p.username);
        }
    }
    if (gs.playerX && gs.playerO && gs.status === "waiting") {
        gs.status = "playing";
        gs.currentTurn = gs.playerX;
        gs.turnStartTime = Date.now();
        dispatcher.matchLabelUpdate(JSON.stringify({ open: 0, code: gs.roomCode }));
        dispatcher.broadcastMessage(OpCode.GAME_STATE, buildPayload(gs, null), null, null, true);
        logger.info("Game started!");
    } else if (gs.status === "waiting") {
        dispatcher.broadcastMessage(OpCode.WAITING_FOR_OPPONENT, JSON.stringify({ message: "Waiting for opponent..." }), presences, null, true);
    }
    return { state: gs };
}

function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
    var gs = state;
    for (var i = 0; i < presences.length; i++) {
        var p = presences[i];
        logger.info("Player left: %s", p.username);
        if (gs.status === "playing") {
            // If playing vs bot, just end the game — no forfeit awarded
            if (gs.isBot) {
                gs.status = "finished";
                gs.winner = null;
                dispatcher.broadcastMessage(OpCode.GAME_OVER, buildPayload(gs, "opponent_disconnected"), null, null, true);
            } else {
                var winnerUserId = p.userId === gs.playerX ? gs.playerO : gs.playerX;
                var winnerUsername = winnerUserId === gs.playerX ? gs.playerXUsername : gs.playerOUsername;
                gs.status = "finished";
                gs.winner = winnerUserId;
                dispatcher.broadcastMessage(OpCode.GAME_OVER, buildPayload(gs, "opponent_disconnected"), null, null, true);
                updateLeaderboard(nk, winnerUserId, winnerUsername, p.userId, p.username);
            }
        }
    }
    return { state: gs };
}

function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
    var gs = state;
    if (gs.status === "finished") return null;

    // ── Bot join logic: count ticks while waiting for second player ──
    if (gs.status === "waiting" && gs.playerX && !gs.isPrivate) {
        gs.waitingTicks++;
        if (gs.waitingTicks >= BOT_WAIT_TICKS) {
            // Spawn bot as Player O
            gs.playerO = BOT_USER_ID;
            gs.playerOUsername = BOT_USERNAME;
            gs.isBot = true;
            gs.status = "playing";
            gs.currentTurn = gs.playerX;
            gs.turnStartTime = Date.now();
            dispatcher.matchLabelUpdate(JSON.stringify({ open: 0, code: gs.roomCode }));
            dispatcher.broadcastMessage(OpCode.GAME_STATE, buildPayload(gs, null), null, null, true);
            logger.info("Bot joined match as Player O after %d seconds", gs.waitingTicks);
        }
    }

    // ── Turn timeout (applies to human turns only) ───────────────────
    if (gs.status === "playing" && gs.turnStartTime > 0) {
        var isBotTurn = gs.isBot && gs.currentTurn === BOT_USER_ID;
        if (!isBotTurn) {
            var elapsed = Date.now() - gs.turnStartTime;
            if (elapsed >= TURN_TIME_LIMIT) {
                logger.info("Turn timeout for: %s", gs.currentTurn);
                gs.currentTurn = gs.currentTurn === gs.playerX ? gs.playerO : gs.playerX;
                gs.turnStartTime = Date.now();
                // If it's now bot's turn after timeout, schedule bot move
                if (gs.isBot && gs.currentTurn === BOT_USER_ID) {
                    gs.botMoveScheduledAt = Date.now();
                }
                dispatcher.broadcastMessage(OpCode.TURN_TIMEOUT, buildPayload(gs, "timeout"), null, null, true);
            }
        }
    }

    // ── Bot move execution with delay ────────────────────────────────
    if (gs.isBot && gs.status === "playing" && gs.currentTurn === BOT_USER_ID && gs.botMoveScheduledAt > 0) {
        var botElapsed = Date.now() - gs.botMoveScheduledAt;
        if (botElapsed >= BOT_MOVE_DELAY * 1000) {
            executeBotMove(logger, nk, dispatcher, gs);
        }
    }

    // ── Process human messages ───────────────────────────────────────
    for (var i = 0; i < messages.length; i++) {
        if (messages[i].opCode === OpCode.MAKE_MOVE) {
            handleMove(logger, nk, dispatcher, gs, messages[i]);
        }
    }

    return { state: gs };
}

function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    return { state: state };
}

function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
    return { state: state };
}

// ── RPC Functions ─────────────────────────────────────

function generateRoomCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    for (var i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function rpcFindMatch(ctx, logger, nk, payload) {
    try {
        var matches = nk.matchList(10, true, null, 0, 1, null);
        logger.info("Available matches: %d", matches ? matches.length : 0);
        if (matches && matches.length > 0) {
            for (var i = 0; i < matches.length; i++) {
                var m = matches[i];
                try {
                    var label = JSON.parse(m.label);
                    if (label.open === 1 && !label.code && m.size < 2) {
                        logger.info("Found open match: %s", m.matchId);
                        return JSON.stringify({ matchId: m.matchId });
                    }
                } catch(e) {}
            }
        }
    } catch(e) {
        logger.error("matchList error: %v", e);
    }
    var matchId = nk.matchCreate(MODULE_NAME, {});
    logger.info("Created new match: %s", matchId);
    return JSON.stringify({ matchId: matchId });
}

function rpcCreatePrivateRoom(ctx, logger, nk, payload) {
    var code = generateRoomCode();
    var matchId = nk.matchCreate(MODULE_NAME, { code: code });
    logger.info("Created private room: %s code: %s", matchId, code);
    return JSON.stringify({ matchId: matchId, code: code });
}

function rpcJoinByCode(ctx, logger, nk, payload) {
    var data;
    try {
        data = JSON.parse(payload);
    } catch(e) {
        return JSON.stringify({ error: "Invalid payload" });
    }
    var code = (data.code || '').toString().toUpperCase().trim();
    if (!code || code.length !== 6) {
        return JSON.stringify({ error: "Invalid room code" });
    }
    try {
        var matches = nk.matchList(50, true, null, 0, 2, null);
        if (matches && matches.length > 0) {
            for (var i = 0; i < matches.length; i++) {
                var m = matches[i];
                try {
                    var label = JSON.parse(m.label);
                    if (label.code === code && m.size < 2) {
                        logger.info("Found room by code: %s -> %s", code, m.matchId);
                        return JSON.stringify({ matchId: m.matchId });
                    }
                } catch(e) {}
            }
        }
    } catch(e) {
        logger.error("join_by_code error: %v", e);
    }
    return JSON.stringify({ error: "Room not found or already full" });
}

function rpcGetLeaderboard(ctx, logger, nk, payload) {
    try {
        var wins = nk.leaderboardRecordsList("global_wins", [], 20, undefined, undefined);
        var losses = nk.leaderboardRecordsList("global_losses", [], 20, undefined, undefined);
        var stats = {};
        var wr = wins.records || [];
        for (var i = 0; i < wr.length; i++) {
            stats[wr[i].ownerId] = { username: wr[i].username || wr[i].ownerId, wins: Number(wr[i].score), losses: 0 };
        }
        var lr = losses.records || [];
        for (var i = 0; i < lr.length; i++) {
            if (stats[lr[i].ownerId]) {
                stats[lr[i].ownerId].losses = Number(lr[i].score);
            } else {
                stats[lr[i].ownerId] = { username: lr[i].username || lr[i].ownerId, wins: 0, losses: Number(lr[i].score) };
            }
        }
        var keys = Object.keys(stats);
        var leaderboard = [];
        for (var i = 0; i < keys.length; i++) {
            var uid = keys[i];
            var d = stats[uid];
            var total = d.wins + d.losses;
            leaderboard.push({
                userId: uid,
                username: d.username,
                wins: d.wins,
                losses: d.losses,
                winRate: total > 0 ? Math.round((d.wins / total) * 100) : 0
            });
        }
        leaderboard.sort(function(a, b) { return b.wins - a.wins || b.winRate - a.winRate; });
        return JSON.stringify({ leaderboard: leaderboard.slice(0, 20) });
    } catch (e) {
        logger.error("Leaderboard error: %v", e);
        return JSON.stringify({ leaderboard: [] });
    }
}

// ── InitModule ────────────────────────────────────────

function InitModule(ctx, logger, nk, initializer) {
    try {
        nk.leaderboardCreate("global_wins", false, "descending", "increment", undefined, {});
        nk.leaderboardCreate("global_losses", false, "descending", "increment", undefined, {});
    } catch (e) {
        logger.warn("Leaderboards may already exist");
    }
    initializer.registerMatch(MODULE_NAME, {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal
    });
    initializer.registerRpc("find_match", rpcFindMatch);
    initializer.registerRpc("create_private_room", rpcCreatePrivateRoom);
    initializer.registerRpc("join_by_code", rpcJoinByCode);
    initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
    logger.info("Tic-Tac-Toe module loaded (bot support enabled)!");
}

globalThis.InitModule = InitModule;