import React from 'react'

interface BoardProps {
  board: (string | null)[]
  winningLine: number[] | null
  isMyTurn: boolean
  disabled: boolean
  onCellClick: (index: number) => void
}

export default function Board({ board, winningLine, isMyTurn, disabled, onCellClick }: BoardProps) {
  const isWinning = (index: number) => winningLine?.includes(index) ?? false

  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="grid grid-cols-3 gap-3">
        {board.map((cell, index) => {
          const winning = isWinning(index)
          const empty = cell === null
          const clickable = empty && isMyTurn && !disabled

          return (
            <button
              key={index}
              onClick={() => clickable && onCellClick(index)}
              disabled={!clickable}
              className={`cell-btn h-24 sm:h-28
                ${winning ? 'cell-winning' : ''}
                ${cell === 'X' ? 'cell-x' : ''}
                ${cell === 'O' ? 'cell-o' : ''}
                ${clickable ? 'hover:scale-[1.03] active:scale-95' : ''}
              `}
              aria-label={cell ? `Cell ${index + 1}: ${cell}` : `Cell ${index + 1}: empty`}
            >
              {cell && (
                <span
                  className="font-display text-4xl sm:text-5xl leading-none"
                  style={{
                    animation: 'popIn 0.15s cubic-bezier(0.34,1.56,0.64,1) both',
                  }}
                >
                  {cell}
                </span>
              )}

              {/* Hover hint dot */}
              {!cell && clickable && (
                <span className="w-2 h-2 rounded-full bg-accent/30 group-hover:bg-accent/60 transition-colors" />
              )}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes popIn {
          from { transform: scale(0.4) rotate(-8deg); opacity: 0; }
          to   { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
