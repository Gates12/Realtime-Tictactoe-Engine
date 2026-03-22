import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { nakama } from '../lib/nakama'

export default function LobbyPage() {
  const { username } = useAuth()
  const navigate = useNavigate()
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const handleFindMatch = async () => {
    setSearching(true)
    setError('')
    try {
      const matchId = await nakama.findMatch()
      navigate('/game', { state: { matchId } })
    } catch (e: any) {
      setError(e?.message || 'Failed to find match. Is Nakama running?')
      setSearching(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">

        {/* Welcome */}
        <div className="text-center">
          <h1 className="font-display text-5xl tracking-widest text-white uppercase mb-2">
            Game Lobby
          </h1>
          <p className="text-muted font-body">
            Welcome back, <span className="text-glow font-mono">{username}</span>
          </p>
        </div>

        {/* Main action card */}
        <div className="card p-8 text-center space-y-6">
          {/* Board preview */}
          <div className="grid grid-cols-3 gap-2 w-32 mx-auto">
            {['X', null, 'O', null, 'X', null, 'O', null, 'X'].map((cell, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg border border-border flex items-center justify-center
                           text-sm font-display"
                style={{ fontSize: '1rem' }}
              >
                {cell === 'X' && <span className="text-x">X</span>}
                {cell === 'O' && <span className="text-o">O</span>}
              </div>
            ))}
          </div>

          <div>
            <h2 className="font-body font-semibold text-white text-lg mb-1">Quick Match</h2>
            <p className="text-muted text-sm font-body">
              Auto-pair with an available opponent. If no one is waiting, a room is created for you.
            </p>
          </div>

          {error && (
            <div className="bg-x/10 border border-x/20 rounded-xl px-4 py-3 text-x text-sm font-body">
              {error}
            </div>
          )}

          <button
            onClick={handleFindMatch}
            disabled={searching}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed
                       disabled:transform-none disabled:shadow-none flex items-center justify-center gap-3
                       text-base py-4"
          >
            {searching ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Finding Match...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Find Match
              </>
            )}
          </button>
        </div>

        {/* Info pills */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {[
            { icon: '⚡', label: 'Real-time' },
            { icon: '🔒', label: 'Server-authoritative' },
            { icon: '🌐', label: 'Multiplayer' },
          ].map(item => (
            <div
              key={item.label}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-muted text-xs font-body"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
