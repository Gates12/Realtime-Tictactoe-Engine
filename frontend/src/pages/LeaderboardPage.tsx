import React, { useEffect, useState } from 'react'
import { nakama, LeaderboardEntry } from '../lib/nakama'

const MEDAL = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLeaderboard = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await nakama.getLeaderboard()
      setEntries(data)
    } catch (e: any) {
      setError(e?.message || 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl tracking-widest text-white uppercase">
              Leaderboard
            </h1>
            <p className="text-muted font-body text-sm mt-1">Top players by total wins</p>
          </div>
          <button
            onClick={fetchLeaderboard}
            disabled={loading}
            className="btn-ghost text-sm flex items-center gap-2 disabled:opacity-40"
          >
            <svg
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-x/10 border border-x/20 rounded-xl px-4 py-3 text-x text-sm font-body">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="card overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border text-xs font-body text-muted uppercase tracking-wider">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Player</div>
            <div className="col-span-2 text-right">Wins</div>
            <div className="col-span-2 text-right">Losses</div>
            <div className="col-span-2 text-right">Win %</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-muted font-body text-sm">Loading rankings...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="text-4xl">🎮</span>
              <p className="text-muted font-body text-sm">No games played yet. Be the first!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {entries.map((entry, index) => (
                <div
                  key={entry.userId}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 items-center
                    hover:bg-surface/50 transition-colors
                    ${index < 3 ? 'bg-accent/[0.02]' : ''}
                  `}
                >
                  {/* Rank */}
                  <div className="col-span-1 font-mono text-sm">
                    {index < 3 ? (
                      <span>{MEDAL[index]}</span>
                    ) : (
                      <span className="text-muted">{index + 1}</span>
                    )}
                  </div>

                  {/* Username */}
                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-display font-bold shrink-0
                        ${index % 2 === 0
                          ? 'bg-x/10 text-x border border-x/20'
                          : 'bg-o/10 text-o border border-o/20'
                        }
                      `}
                    >
                      {entry.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-mono text-sm text-white truncate">{entry.username}</span>
                  </div>

                  {/* Wins */}
                  <div className="col-span-2 text-right font-mono text-sm text-o font-semibold">
                    {entry.wins}
                  </div>

                  {/* Losses */}
                  <div className="col-span-2 text-right font-mono text-sm text-x">
                    {entry.losses}
                  </div>

                  {/* Win rate */}
                  <div className="col-span-2 text-right">
                    <div className="inline-flex flex-col items-end gap-1">
                      <span className="font-mono text-sm text-white">{entry.winRate}%</span>
                      <div className="w-16 h-1 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all"
                          style={{ width: `${entry.winRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-muted/40 text-xs font-body">
          Rankings update after each game · Top 20 players shown
        </p>
      </div>
    </div>
  )
}
