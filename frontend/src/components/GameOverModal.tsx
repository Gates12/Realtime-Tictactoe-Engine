import React from 'react'

interface GameOverModalProps {
  winner: string | null        // session ID or 'draw'
  reason: string
  mySessionId: string
  playerXSessionId: string
  playerOSessionId: string
  playerXUsername: string
  playerOUsername: string
  onPlayAgain: () => void
  onGoLobby: () => void
}

export default function GameOverModal({
  winner,
  reason,
  mySessionId,
  playerXSessionId,
  playerOSessionId,
  playerXUsername,
  playerOUsername,
  onPlayAgain,
  onGoLobby,
}: GameOverModalProps) {
  const isDraw = winner === 'draw'
  const iWon = !isDraw && winner === mySessionId

  const winnerUsername =
    winner === playerXSessionId ? playerXUsername :
    winner === playerOSessionId ? playerOUsername : null

  let emoji = isDraw ? '🤝' : iWon ? '🏆' : '💀'
  let headline = isDraw ? 'Draw!' : iWon ? 'You Win!' : 'You Lose'
  let sub = isDraw
    ? "It's a tie — both played well"
    : reason === 'opponent_disconnected'
    ? 'Your opponent disconnected'
    : iWon
    ? `You defeated ${winnerUsername === (iWon ? playerOUsername : playerXUsername) ? '' : winnerUsername}`
    : `${winnerUsername} wins this round`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/80 backdrop-blur-md"
        style={{ animation: 'fadeIn 0.2s ease both' }}
      />

      {/* Modal */}
      <div
        className="relative card p-8 w-full max-w-sm text-center space-y-6"
        style={{ animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Result */}
        <div className="space-y-2">
          <div className="text-6xl">{emoji}</div>
          <h2
            className={`font-display text-5xl tracking-widest uppercase
              ${isDraw ? 'text-muted' : iWon ? 'text-o' : 'text-x'}
            `}
          >
            {headline}
          </h2>
          <p className="text-muted font-body text-sm">{sub}</p>
        </div>

        {/* Score summary */}
        <div className="flex items-center justify-center gap-6 py-4 border-y border-border">
          <div className="text-center">
            <div className="badge-x mb-1">X</div>
            <div className="text-xs text-muted font-body mt-1">{playerXUsername}</div>
          </div>
          <div className="text-muted font-display text-2xl">VS</div>
          <div className="text-center">
            <div className="badge-o mb-1">O</div>
            <div className="text-xs text-muted font-body mt-1">{playerOUsername}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button onClick={onPlayAgain} className="btn-primary w-full py-3">
            Play Again
          </button>
          <button onClick={onGoLobby} className="btn-ghost w-full">
            Back to Lobby
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp {
          from { transform: translateY(24px) scale(0.95); opacity: 0 }
          to   { transform: translateY(0) scale(1); opacity: 1 }
        }
      `}</style>
    </div>
  )
}
