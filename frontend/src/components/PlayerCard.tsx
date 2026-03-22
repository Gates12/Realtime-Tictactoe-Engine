import React from 'react'

interface PlayerCardProps {
  username: string
  symbol: 'X' | 'O'
  isMyTurn: boolean
  isMe: boolean
}

export default function PlayerCard({ username, symbol, isMyTurn, isMe }: PlayerCardProps) {
  return (
    <div
      className={`card px-4 py-3 flex items-center gap-3 transition-all duration-300
        ${isMyTurn ? 'border-accent/50 shadow-glow' : 'opacity-60'}
      `}
    >
      {/* Symbol badge */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center font-display text-2xl font-bold shrink-0
          ${symbol === 'X'
            ? 'bg-x/10 text-x border border-x/20'
            : 'bg-o/10 text-o border border-o/20'
          }
        `}
      >
        {symbol}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-white truncate">{username}</span>
          {isMe && (
            <span className="text-[10px] font-body text-muted border border-border px-1.5 py-0.5 rounded shrink-0">
              You
            </span>
          )}
        </div>
        <div className="text-xs font-body text-muted mt-0.5">
          {isMyTurn ? (
            <span className={`${symbol === 'X' ? 'text-x' : 'text-o'} font-medium`}>
              ● Thinking...
            </span>
          ) : (
            'Waiting'
          )}
        </div>
      </div>

      {/* Turn indicator pulse */}
      {isMyTurn && (
        <div
          className={`w-2.5 h-2.5 rounded-full shrink-0 animate-pulse
            ${symbol === 'X' ? 'bg-x' : 'bg-o'}
          `}
        />
      )}
    </div>
  )
}
