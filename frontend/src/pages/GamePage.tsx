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
  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [joinError, setJoinError] = useState('')
  const [myRoomCode, setMyRoomCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
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

    // Auto-join from URL ?room=CODE
    const params = new URLSearchParams(window.location.search)
    const roomCode = params.get('room')
    if (roomCode && roomCode.length === 6) {
      setRoomCodeInput(roomCode.toUpperCase())
      setTimeout(() => {
        handleJoinByCode(roomCode.toUpperCase())
      }, 500)
    }
  }, [])

  const handleFindMatch = async () => {
    setPhase('searching')
    setErrorMsg('')
    setMyRoomCode(null)
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

  const handleCreatePrivateRoom = async () => {
    setPhase('searching')
    setErrorMsg('')
    leftRef.current = false
    try {
      const { matchId, code } = await nakama.createPrivateRoom()
      matchIdRef.current = matchId
      setMyRoomCode(code)
      await nakama.joinMatch(matchId)
      setPhase('waiting')
    } catch (e: any) {
      setPhase('error')
      setErrorMsg(e?.message || 'Failed to create room')
    }
  }

  const handleJoinByCode = async (codeOverride?: string) => {
    const code = (codeOverride || roomCodeInput).toUpperCase().trim()
    if (code.length !== 6) return
    setJoinError('')
    setPhase('searching')
    leftRef.current = false
    try {
      const matchId = await nakama.joinByCode(code)
      matchIdRef.current = matchId
      await nakama.joinMatch(matchId)
      setPhase('waiting')
    } catch (e: any) {
      setPhase('idle')
      setJoinError(e?.message || 'Room not found')
    }
  }

  const handleCopyInvite = () => {
    if (!myRoomCode) return
    const url = `${window.location.origin}?room=${myRoomCode}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
    setMyRoomCode(null)
    // Clear URL param
    window.history.replaceState({}, '', window.location.pathname)
  }

  const handlePlayAgain = async () => {
    const id = matchIdRef.current
    if (id && !leftRef.current) {
      leftRef.current = true
      await nakama.leaveMatch(id)
    }
    matchIdRef.current = null
    setGameState(null)
    setMyRoomCode(null)
    setPhase('idle')
  }

  const isMyTurn =
    phase === 'playing' && !!gameState && !!mySessionId &&
    gameState.currentTurn === mySessionId

  const mySymbol =
    gameState?.playerX === mySessionId ? 'X' :
    gameState?.playerO === mySessionId ? 'O' : null

  // ── Idle ──────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center mb-2">
            <h1 className="font-display text-4xl sm:text-5xl tracking-widest text-white uppercase mb-1">
              Game Lobby
            </h1>
            <p className="text-muted font-body text-sm">Choose how you want to play</p>
          </div>

          {/* Quick Match */}
          <div className="card p-5 space-y-3">
            <div>
              <h2 className="font-body font-semibold text-white text-base mb-0.5">⚡ Quick Match</h2>
              <p className="text-muted text-xs font-body">Auto-pair with a random opponent</p>
            </div>
            <button
              onClick={handleFindMatch}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Find Match
            </button>
          </div>

          {/* Private Room */}
          <div className="card p-5 space-y-3">
            <div>
              <h2 className="font-body font-semibold text-white text-base mb-0.5">🔒 Private Room</h2>
              <p className="text-muted text-xs font-body">Create a room and invite a friend with a code</p>
            </div>
            <button
              onClick={handleCreatePrivateRoom}
              className="w-full btn-ghost py-3 text-sm flex items-center justify-center gap-2"
            >
              Create Private Room
            </button>
          </div>

          {/* Join by Code */}
          <div className="card p-5 space-y-3">
            <div>
              <h2 className="font-body font-semibold text-white text-base mb-0.5">🎟️ Join by Code</h2>
              <p className="text-muted text-xs font-body">Enter a 6-letter code from your friend</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomCodeInput}
                onChange={e => {
                  setRoomCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                  setJoinError('')
                }}
                onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
                placeholder="ABC123"
                maxLength={6}
                className="flex-1 bg-surface border border-border focus:border-accent/60 rounded-xl
                           px-4 py-2.5 text-white font-mono text-sm outline-none tracking-[0.3em]
                           transition-all duration-200 placeholder:text-muted/30 uppercase"
              />
              <button
                onClick={() => handleJoinByCode()}
                disabled={roomCodeInput.length !== 6}
                className="btn-primary px-5 py-2.5 text-sm disabled:opacity-40
                           disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                Join
              </button>
            </div>
            {joinError && (
              <p className="text-x text-xs font-body flex items-center gap-1">
                <span>⚠</span> {joinError}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Searching / Waiting ───────────────────────────────────
  if (phase === 'searching' || phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-accent/20 rounded-full" />
          <div className="absolute inset-0 w-16 h-16 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>

        <div className="text-center">
          <h2 className="font-display text-3xl tracking-widest text-white uppercase mb-2">
            {phase === 'searching' ? 'Connecting...' : 'Waiting for Opponent'}
          </h2>
          <p className="text-muted font-body text-sm">
            {phase === 'searching' ? 'Setting up your game...' : 'Share the code with your friend!'}
          </p>
        </div>

        {/* Room code card — shown when waiting in private room */}
        {phase === 'waiting' && myRoomCode && (
          <div className="card p-6 text-center space-y-4 w-full max-w-xs">
            <p className="text-muted text-xs font-body uppercase tracking-wider">Room Code</p>
            <div className="font-mono text-4xl tracking-[0.4em] text-white font-bold">
              {myRoomCode}
            </div>
            <button
              onClick={handleCopyInvite}
              className="w-full btn-ghost py-2.5 text-sm flex items-center justify-center gap-2"
            >
              {copied ? (
                <>✅ Copied!</>
              ) : (
                <>📋 Copy Invite Link</>
              )}
            </button>
            <p className="text-muted/40 text-xs font-body">
              Friend opens the link to join instantly
            </p>
          </div>
        )}

        {/* Waiting for random match */}
        {phase === 'waiting' && !myRoomCode && matchIdRef.current && (
          <p className="text-muted/40 font-mono text-xs">
            Room #{matchIdRef.current.slice(-8).toUpperCase()}
          </p>
        )}

        <button onClick={handleLeave} className="btn-ghost text-sm">Cancel</button>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
        <div className="text-x text-5xl">⚠</div>
        <h2 className="font-display text-3xl text-white tracking-widest uppercase">Error</h2>
        <p className="text-muted font-body text-sm text-center max-w-xs">{errorMsg}</p>
        <button onClick={() => { setPhase('idle'); setErrorMsg('') }} className="btn-primary">
          Try Again
        </button>
      </div>
    )
  }

  // ── Playing / Finished ────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4 py-4 sm:py-6 gap-4 sm:gap-6 max-w-sm mx-auto w-full">
      <div className="w-full flex items-center justify-between">
        <span className="text-xs font-mono text-muted/50 truncate">
          #{matchIdRef.current?.slice(-8).toUpperCase()}
        </span>
        <button
          onClick={handleLeave}
          className="text-xs text-muted hover:text-x font-body transition-colors shrink-0"
        >
          Forfeit
        </button>
      </div>

      {gameState && (
        <div className="w-full grid grid-cols-2 gap-2 sm:gap-3">
          <PlayerCard
            username={gameState.playerXUsername} symbol="X"
            isMyTurn={gameState.currentTurn === gameState.playerX}
            isMe={gameState.playerX === mySessionId}
          />
          <PlayerCard
            username={gameState.playerOUsername} symbol="O"
            isMyTurn={gameState.currentTurn === gameState.playerO}
            isMe={gameState.playerO === mySessionId}
          />
        </div>
      )}

      <div className="text-sm font-body text-center">
        {isMyTurn
          ? <span className="text-glow font-medium">Your turn — place your {mySymbol}</span>
          : <span className="text-muted">Waiting for opponent's move...</span>
        }
      </div>

      {gameState && gameState.turnStartTime > 0 && (
        <TurnTimer turnStartTime={gameState.turnStartTime} isMyTurn={isMyTurn} />
      )}

      {gameState && (
        <Board
          board={gameState.board}
          winningLine={gameState.winningLine}
          isMyTurn={isMyTurn}
          disabled={phase !== 'playing'}
          onCellClick={handleCellClick}
        />
      )}

      {gameState && (
        <p className="text-xs font-mono text-muted/40">Move {gameState.moveCount} / 9</p>
      )}

      {phase === 'finished' && gameState && (
        <GameOverModal
          winner={gameState.winner}
          reason={gameState.reason || 'win'}
          mySessionId={mySessionId}
          playerXSessionId={gameState.playerX}
          playerOSessionId={gameState.playerO}
          playerXUsername={gameState.playerXUsername}
          playerOUsername={gameState.playerOUsername}
          onPlayAgain={handlePlayAgain}
          onGoLobby={handleLeave}
        />
      )}
    </div>
  )
}