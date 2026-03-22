import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Navbar() {
  const { username, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 group">
          <span className="font-display text-xl text-x leading-none">X</span>
          <span className="font-display text-xl text-muted leading-none">/</span>
          <span className="font-display text-xl text-o leading-none">O</span>
          <span className="font-display text-lg tracking-widest text-white ml-1 uppercase group-hover:text-glow transition-colors">
            TicTacToe
          </span>
        </NavLink>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-body transition-colors ${
                isActive ? 'text-white bg-card' : 'text-muted hover:text-white'
              }`
            }
          >
            Lobby
          </NavLink>
          <NavLink
            to="/leaderboard"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-body transition-colors ${
                isActive ? 'text-white bg-card' : 'text-muted hover:text-white'
              }`
            }
          >
            Leaderboard
          </NavLink>
        </nav>

        {/* User */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-o animate-pulse" />
            <span className="text-sm font-mono text-muted">{username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-muted hover:text-x font-body transition-colors px-2 py-1"
          >
            Leave
          </button>
        </div>
      </div>
    </header>
  )
}
