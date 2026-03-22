import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@heroiclabs/nakama-js';
import { nakama, getOrCreateDeviceId, getSavedUsername, saveUsername } from '../lib/nakama';

interface AuthContextType {
  session: Session | null;
  username: string;
  isLoading: boolean;
  login: (username: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to auto-login with saved username
    const saved = getSavedUsername();
    if (saved) {
      login(saved).catch(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (name: string) => {
    setIsLoading(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const sess = await nakama.authenticateDevice(deviceId, name);
      setSession(sess);
      setUsername(name);
      saveUsername(name);
      await nakama.createSocket();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    nakama.disconnect();
    setSession(null);
    setUsername('');
    localStorage.removeItem('ttt_username');
  };

  return (
    <AuthContext.Provider value={{ session, username, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
