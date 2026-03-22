import React, { useEffect, useState } from 'react'

interface TurnTimerProps {
  turnStartTime: number
  isMyTurn: boolean
}

export default function TurnTimer({ turnStartTime, isMyTurn }: TurnTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(30)

  useEffect(() => {
    if (!turnStartTime) return
    const update = () => {
      const elapsed = Math.floor((Date.now() - turnStartTime) / 1000)
      setSecondsLeft(Math.max(0, 30 - elapsed))
    }
    update()
    const interval = setInterval(update, 250)
    return () => clearInterval(interval)
  }, [turnStartTime])

  const pct = (secondsLeft / 30) * 100
  const isDanger = secondsLeft <= 5
  const isWarning = secondsLeft <= 10

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <span className={`font-mono text-2xl font-bold tabular-nums ${
          isDanger ? 'text-x animate-pulse' : isWarning ? 'text-yellow-400' : 'text-muted'
        }`}>
          {secondsLeft}s
        </span>
        {isMyTurn && (
          <span className="text-xs font-body text-muted">
            {isDanger ? '⚠ Hurry!' : isWarning ? 'Running low...' : 'to move'}
          </span>
        )}
      </div>
      <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-250 ${
            isDanger ? 'bg-x' : isWarning ? 'bg-yellow-400' : 'bg-accent'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}