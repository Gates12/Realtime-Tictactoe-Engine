import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { login, session } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  React.useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [session])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = username.trim()
    if (!trimmed || trimmed.length < 2) {
      setError('Username must be at least 2 characters')
      return
    }
    if (trimmed.length > 20) {
      setError('Username must be 20 characters or less')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login(trimmed)
      navigate('/')
    } catch (e: any) {
      setError(e?.message || 'Failed to connect. Is Nakama running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#7c6af7 1px, transparent 1px), linear-gradient(90deg, #7c6af7 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-x/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="font-display text-5xl text-x tracking-tight leading-none">X</span>
            <div className="w-px h-10 bg-border" />
            <span className="font-display text-5xl text-o tracking-tight leading-none">O</span>
          </div>
          <h1 className="font-display text-4xl tracking-widest text-white uppercase">TicTacToe</h1>
          <p className="text-muted font-body text-sm mt-2 tracking-wide">Real-time multiplayer</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="font-body font-semibold text-white text-lg mb-1">Enter the arena</h2>
          <p className="text-muted text-sm font-body mb-6">Choose your username to get started</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                placeholder="YourUsername"
                autoFocus
                maxLength={20}
                className="w-full bg-surface border border-border focus:border-accent/60 rounded-xl
                           px-4 py-3 text-white font-mono text-sm outline-none
                           transition-all duration-200 placeholder:text-muted/40"
              />
              {error && (
                <p className="mt-2 text-x text-xs font-body">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full btn-primary disabled:opacity-40 disabled:cursor-not-allowed
                         disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                'Play Now'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-muted/50 text-xs font-body mt-6">
          No account needed · Your device ID is your identity
        </p>
      </div>
    </div>
  )
}
