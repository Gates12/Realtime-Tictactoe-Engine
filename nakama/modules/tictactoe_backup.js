var MODULE_NAME = "tictactoe";
var TICK_RATE = 1;
var MAX_PLAYERS = 2;

var OpCode = {
    GAME_STATE: 1,
    MOVE_ACCEPTED: 2,
    MOVE_REJECTED: 3,
    GAME_OVER: 4,
    PLAYER_JOINED: 5,
    PLAYER_LEFT: 6,
    WAITING_FOR_OPPONENT: 7,
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

function updateLeaderboard(nk, winnerUserId, winnerUsername, loserUserId, loserUsername) {
    try {
        nk.leaderboardRecordWrite("global_wins", winnerUserId, winnerUsername, 1, 0, {});
        nk.leaderboardRecordWrite("global_losses", loserUserId, loserUsername, 1, 0, {});
    } catch (e) {}
}

function buildPayload(gs, extra) {
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
        reason: extra || null
    });
}

function handleMove(logger, nk, dispatcher, gs, message) {
    function reject(reason) {
        dispatcher.broadcastMessage(OpCode.MOVE_REJECTED, JSON.stringify({ reason: reason }), [message.sender], null, true);
    }
    if (gs.status !== "playing") { reject("Game not in progress"); return; }
    if (message.sender.sessionId !== gs.currentTurn) { reject("Not your turn"); return; }
    var moveData;
    try {
        moveData = JSON.parse(nk.binaryToString(message.data));
    } catch (e) { reject("Invalid message format"); return; }
    var position = moveData.position;
    if (position === undefined || position < 0 || position > 8) { reject("Invalid position"); return; }
    if (gs.board[position] !== null) { reject("Cell already occupied"); return; }
    var symbol = message.sender.sessionId === gs.playerX ? "X" : "O";
    gs.board[position] = symbol;
    gs.moveCount++;
    logger.info("Move: %s at %d", symbol, position);
    var result = checkWinner(gs.board);
    if (result.winner) {
        var isXWin = result.winner === "X";
        var winnerSessionId = isXWin ? gs.playerX : gs.playerO;
        var loserSessionId = isXWin ? gs.playerO : gs.playerX;
        var winnerUsername = isXWin ? gs.playerXUsername : gs.playerOUsername;
        var loserUsername = isXWin ? gs.playerOUsername : gs.playerXUsername;
        gs.status = "finished";
        gs.winner = winnerSessionId;
        gs.winningLine = result.line;
        dispatcher.broadcastMessage(OpCode.GAME_OVER, buildPayload(gs, "win"), null, null, true);
        updateLeaderboard(nk, winnerSessionId, winnerUsername, loserSessionId, loserUsername);
        return;
    }
    if (isBoardFull(gs.board)) {
        gs.status = "finished";
        gs.winner = "draw";
        dispatcher.broadcastMessage(OpCode.GAME_OVER, buildPayload(gs, "draw"), null, null, true);
        return;
    }
    gs.currentTurn = gs.currentTurn === gs.playerX ? gs.playerO : gs.playerX;
    dispatcher.broadcastMessage(OpCode.GAME_STATE, buildPayload(gs, null), null, null, true);
}

function InitModule(ctx, logger, nk, initializer) {
    try {
        nk.leaderboardCreate("global_wins", false, "descending", "increment", undefined, {});
        nk.leaderboardCreate("global_losses", false, "descending", "increment", undefined, {});
    } catch (e) {
        logger.warn("Leaderboards may already exist");
    }

    initializer.registerMatch(MODULE_NAME, {
        matchInit: function(ctx, logger, nk, params) {
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
                moveCount: 0
            };
            logger.info("Match initialized: %s", ctx.matchId);
            return { state: state, tickRate: TICK_RATE, label: JSON.stringify({ open: 1 }) };
        },
        matchJoinAttempt: function(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
            var gs = state;
            if (gs.status === "finished") return { state: state, accept: false, rejectMessage: "Match already finished" };
            var count = (gs.playerX ? 1 : 0) + (gs.playerO ? 1 : 0);
            if (count >= MAX_PLAYERS) return { state: state, accept: false, rejectMessage: "Match is full" };
            return { state: state, accept: true };
        },
        matchJoin: function(ctx, logger, nk, dispatcher, tick, state, presences) {
            var gs = state;
            for (var i = 0; i < presences.length; i++) {
                var p = presences[i];
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
                dispatcher.broadcastMessage(OpCode.GAME_STATE, buildPayload(gs, null), null, null, true);
                logger.info("Game started!");
            } else if (gs.status === "waiting") {
                dispatcher.broadcastMessage(OpCode.WAITING_FOR_OPPONENT, JSON.stringify({ message: "Waiting for opponent..." }), presences, null, true);
            }
            return { state: gs };
        },
        matchLeave: function(ctx, logger, nk, dispatcher, tick, state, presences) {
            var gs = state;
            for (var i = 0; i < presences.length; i++) {
                var p = presences[i];
                logger.info("Player left: %s", p.username);
                if (gs.status === "playing") {
                    var winnerSessionId = p.sessionId === gs.playerX ? gs.playerO : gs.playerX;
                    var winnerUserId = winnerSessionId === gs.playerX ? gs.playerX : gs.playerO;
                    var winnerUsername = winnerSessionId === gs.playerX ? gs.playerXUsername : gs.playerOUsername;
                    gs.status = "finished";
                    gs.winner = winnerSessionId;
                    dispatcher.broadcastMessage(OpCode.GAME_OVER, buildPayload(gs, "opponent_disconnected"), null, null, true);
                    updateLeaderboard(nk, winnerUserId, winnerUsername, p.userId, p.username);
                }
            }
            return { state: gs };
        },
        matchLoop: function(ctx, logger, nk, dispatcher, tick, state, messages) {
            var gs = state;
            if (gs.status === "finished") return null;
            for (var i = 0; i < messages.length; i++) {
                if (messages[i].opCode === OpCode.MAKE_MOVE) {
                    handleMove(logger, nk, dispatcher, gs, messages[i]);
                }
            }
            return { state: gs };
        },
        matchTerminate: function(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
            return { state: state };
        },
        matchSignal: function(ctx, logger, nk, dispatcher, tick, state, data) {
            return { state: state };
        }
    });

    initializer.registerRpc("find_match", function(ctx, logger, nk, payload) {
        var matches = nk.matchList(10, true, null, 0, 1, '{"open":1}');
        if (matches && matches.length > 0) {
            logger.info("Found open match: %s", matches[0].matchId);
            return JSON.stringify({ matchId: matches[0].matchId });
        }
        var matchId = nk.matchCreate(MODULE_NAME, {});
        logger.info("Created new match: %s", matchId);
        return JSON.stringify({ matchId: matchId });
    });

    initializer.registerRpc("get_leaderboard", function(ctx, logger, nk, payload) {
        try {
            var wins = nk.leaderboardRecordsList("global_wins", [], 20, undefined, undefined);
            var losses = nk.leaderboardRecordsList("global_losses", [], 20, undefined, undefined);
            var stats = {};
            var wr = wins.records || [];
            for (var i = 0; i < wr.length; i++) {
                var r = wr[i];
                stats[r.ownerId] = { username: r.username || r.ownerId, wins: Number(r.score), losses: 0 };
            }
            var lr = losses.records || [];
            for (var i = 0; i < lr.length; i++) {
                var r = lr[i];
                if (stats[r.ownerId]) {
                    stats[r.ownerId].losses = Number(r.score);
                } else {
                    stats[r.ownerId] = { username: r.username || r.ownerId, wins: 0, losses: Number(r.score) };
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
    });

    logger.info("Tic-Tac-Toe module loaded!");
}

globalThis.InitModule = InitModule;