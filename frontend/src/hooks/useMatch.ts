import { useState, useEffect, useCallback, useRef } from 'react';
import { MatchPresenceEvent, MatchData } from '@heroiclabs/nakama-js';
import { nakama, OpCode, GameState } from '../lib/nakama';

type MatchPhase = 'idle' | 'searching' | 'waiting' | 'playing' | 'finished' | 'error';

interface UseMatchReturn {
  phase: MatchPhase;
  matchId: string | null;
  gameState: GameState | null;
  mySessionId: string;
  isMyTurn: boolean;
  errorMessage: string;
  findMatch: () => Promise<void>;
  makeMove: (position: number) => void;
  leaveMatch: () => Promise<void>;
  resetMatch: () => void;
}

export function useMatch(): UseMatchReturn {
  const [phase, setPhase] = useState<MatchPhase>('idle');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const matchIdRef = useRef<string | null>(null);

  const mySessionId = nakama.session?.token
    ? parseSessionId(nakama.session.token)
    : '';

  // Register socket listeners once
  useEffect(() => {
    const socket = nakama.socket;
    if (!socket) return;

    socket.onmatchdata = (data: MatchData) => {
      const payload = data.data
        ? JSON.parse(new TextDecoder().decode(data.data as ArrayBuffer))
        : {};

      switch (data.op_code) {
        case OpCode.WAITING_FOR_OPPONENT:
          setPhase('waiting');
          break;

        case OpCode.GAME_STATE:
          setGameState(payload as GameState);
          setPhase('playing');
          break;

        case OpCode.MOVE_REJECTED:
          console.warn('Move rejected:', payload.reason);
          break;

        case OpCode.GAME_OVER:
          setGameState(payload as GameState);
          setPhase('finished');
          break;
      }
    };

    socket.onmatchpresence = (event: MatchPresenceEvent) => {
      if (event.leaves && event.leaves.length > 0) {
        // handled server-side via matchLeave — game over broadcast will follow
      }
    };

    socket.ondisconnect = () => {
      setPhase('error');
      setErrorMessage('Disconnected from server');
    };
  }, [nakama.socket]);

  const findMatch = useCallback(async () => {
    setPhase('searching');
    setErrorMessage('');
    try {
      const id = await nakama.findMatch();
      matchIdRef.current = id;
      setMatchId(id);
      await nakama.joinMatch(id);
      // Phase transitions via socket messages
    } catch (e: any) {
      setPhase('error');
      setErrorMessage(e?.message || 'Failed to find match');
    }
  }, []);

  const makeMove = useCallback((position: number) => {
    const id = matchIdRef.current;
    if (!id) return;
    nakama.sendMove(id, position);
  }, []);

  const leaveMatch = useCallback(async () => {
    const id = matchIdRef.current;
    if (id) await nakama.leaveMatch(id);
    matchIdRef.current = null;
    setMatchId(null);
    setGameState(null);
    setPhase('idle');
  }, []);

  const resetMatch = useCallback(() => {
    matchIdRef.current = null;
    setMatchId(null);
    setGameState(null);
    setPhase('idle');
    setErrorMessage('');
  }, []);

  const isMyTurn =
    phase === 'playing' &&
    gameState !== null &&
    gameState.currentTurn !== '' &&
    (gameState.playerX === mySessionId || gameState.playerO === mySessionId)
      ? gameState.currentTurn === mySessionId
      : false;

  return {
    phase,
    matchId,
    gameState,
    mySessionId: nakama.session?.token ? getSessionIdFromSocket() : '',
    isMyTurn,
    errorMessage,
    findMatch,
    makeMove,
    leaveMatch,
    resetMatch,
  };
}

function parseSessionId(token: string): string {
  // JWT — second segment is the payload
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return '';
    const payload = JSON.parse(atob(parts[1]));
    return payload.sid || '';
  } catch {
    return '';
  }
}

// Get the current socket session ID
function getSessionIdFromSocket(): string {
  try {
    return nakama.socket?.adapter?.socket?.session?.sid || '';
  } catch {
    return '';
  }
}
