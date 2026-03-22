import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nakama, OpCode, GameState } from '../lib/nakama'
import Board from '../components/Board'
import PlayerCard from '../components/PlayerCard'
import GameOverModal from '../components/GameOverModal'
import TurnTimer from '../components/TurnTimer'

type Phase = 'idle' | 'searching' | 'waiting' | 'playing' | 'finished' | 'error'

export default function GamePage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('idle')
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [mySessionId, setMySessionId] = useState('')
  const matchIdRef = useRef<string | null>(null)
  const leftRef = useRef(false)

  useEffect(() => {
    const userId = nakama.session?.user_id
    if (userId) setMySessionId(userId)

    const socket = nakama.socket
    if (!socket) return

    socket.onmatchdata = (data: any) => {
      let payload: any = {}
      try {
        if (data.data) {
          const bytes = data.data
          const str = typeof bytes === 'string'
            ? bytes
            : new TextDecoder().decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
          payload = JSON.parse(str)
        }
      } catch (e) {
        console.error('Failed to parse match data:', e)
      }

      const op = Number(data.op_code)
      if (op === OpCode.WAITING_FOR_OPPONENT) {
        setPhase('waiting')
      } else if (op === OpCode.GAME_STATE) {
        setGameState(payload as GameState)
        setPhase('playing')
      } else if (op === OpCode.MOVE_REJECTED) {
        console.warn('Move rejected:', payload?.reason)
      } else if (op === OpCode.GAME_OVER) {
        setGameState(payload as GameState)
        setPhase('finished')
      } else if (op === OpCode.TURN_TIMEOUT) {
        setGameState(payload as GameState)
        setPhase('playing')
      }
    }

    socket.ondisconnect = () => {
      setPhase('error')
      setErrorMsg('Disconnected from server')
    }
  }, [])

  const handleFindMatch = async () => {
    setPhase('searching')
    setErrorMsg('')
    leftRef.current = false
    try {
      const matchId = await nakama.findMatch()
      matchIdRef.current = matchId
      await nakama.joinMatch(matchId)
      setPhase('waiting')
    } catch (e: any) {
      setPhase('error')
      setErrorMsg(e?.message || 'Failed to find match')
    }
  }

  const handleCellClick = (position: number) => {
    if (!matchIdRef.current || phase !== 'playing') return
    nakama.sendMove(matchIdRef.current, position)
  }

  const handleLeave = async () => {
    const id = matchIdRef.current
    if (id && !leftRef.current) {
      leftRef.current = true
      await nakama.leaveMatch(id)
    }
    matchIdRef.current = null
    setPhase('idle')
    setGameState(null)
  }

  const handlePlayAgain = async () => {
    const id = matchIdRef.current
    if (id && !leftRef.current) {
      leftRef.current = true
      await nakama.leaveMatch(id)
    }
    matchIdRef.current = null
    setGameState(null)
    setPhase('idle')
  }

  const isMyTurn =
    phase === 'playing' && !!gameState && !!mySessionId &&
    gameState.currentTurn === mySessionId

  const mySymbol =
    gameState?.playerX === mySessionId ? 'X' :
    gameState?.playerO === mySessionId ? 'O' : null

  if (phase === 'idle') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="font-display text-5xl tracking-widest text-white uppercase mb-2">Game Lobby</h1>
          </div>
          <div className="card p-8 text-center space-y-6">
            <div className="grid grid-cols-3 gap-2 w-32 mx-auto">
              {['X', null, 'O', null, 'X', null, 'O', null, 'X'].map((cell, i) => (
                <div key={i} className="aspect-square rounded-lg border border-border flex items-center justify-center">
                  {cell === 'X' && <span className="text-x font-display">X</span>}
                  {cell === 'O' && <span className="text-o font-display">O</span>}
                </div>
              ))}
            </div>
            <div>
              <h2 className="font-body font-semibold text-white text-lg mb-1">Quick Match</h2>
              <p className="text-muted text-sm font-body">Auto-pair with an available opponent.</p>
            </div>
            <button onClick={handleFindMatch} className="w-full btn-primary text-base py-4 flex items-center justify-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Find Match
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'searching' || phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-8">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-accent/20 rounded-full" />
          <div className="absolute inset-0 w-16 h-16 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="text-center">
          <h2 className="font-display text-3xl tracking-widest text-white uppercase mb-2">
            {phase === 'searching' ? 'Finding Match' : 'Waiting for Opponent'}
          </h2>
          <p className="text-muted font-body text-sm">
            {phase === 'searching' ? 'Connecting...' : 'Waiting for another player to join...'}
          </p>
          {matchIdRef.current && (
            <p className="text-muted/40 font-mono text-xs mt-2">
              Room #{matchIdRef.current.slice(-8).toUpperCase()}
            </p>
          )}
        </div>
        <button onClick={handleLeave} className="btn-ghost text-sm">Cancel</button>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
        <div className="text-x text-5xl">⚠</div>
        <h2 className="font-display text-3xl text-white tracking-widest uppercase">Error</h2>
        <p className="text-muted font-body text-sm text-center max-w-xs">{errorMsg}</p>
        <button onClick={() => { setPhase('idle'); setErrorMsg('') }} className="btn-primary">Try Again</button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6 max-w-sm mx-auto w-full">
      <div className="w-full flex items-center justify-between">
        <span className="text-xs font-mono text-muted/50">
          #{matchIdRef.current?.slice(-8).toUpperCase()}
        </span>
        <button onClick={handleLeave} className="text-xs text-muted hover:text-x font-body transition-colors">
          Forfeit
        </button>
      </div>

      {gameState && (
        <div className="w-full grid grid-cols-2 gap-3">
          <PlayerCard username={gameState.playerXUsername} symbol="X"
            isMyTurn={gameState.currentTurn === gameState.playerX}
            isMe={gameState.playerX === mySessionId} />
          <PlayerCard username={gameState.playerOUsername} symbol="O"
            isMyTurn={gameState.currentTurn === gameState.playerO}
            isMe={gameState.playerO === mySessionId} />
        </div>
      )}

      <div className="text-sm font-body text-center">
        {isMyTurn
          ? <span className="text-glow font-medium">Your turn — place your {mySymbol}</span>
          : <span className="text-muted">Waiting for opponent's move...</span>
        }
      </div>

      {gameState && gameState.turnStartTime > 0 && (
        <TurnTimer
          turnStartTime={gameState.turnStartTime}
          isMyTurn={isMyTurn}
        />
      )}

      {gameState && (
        <Board board={gameState.board} winningLine={gameState.winningLine}
          isMyTurn={isMyTurn} disabled={phase !== 'playing'} onCellClick={handleCellClick} />
      )}

      {gameState && <p className="text-xs font-mono text-muted/40">Move {gameState.moveCount} / 9</p>}

      {phase === 'finished' && gameState && (
        <GameOverModal
          winner={gameState.winner} reason={gameState.reason || 'win'}
          mySessionId={mySessionId}
          playerXSessionId={gameState.playerX} playerOSessionId={gameState.playerO}
          playerXUsername={gameState.playerXUsername} playerOUsername={gameState.playerOUsername}
          onPlayAgain={handlePlayAgain} onGoLobby={handleLeave} />
      )}
    </div>
  )
}