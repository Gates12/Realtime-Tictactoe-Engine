import { Client, Session, Socket } from '@heroiclabs/nakama-js';

export const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || 'localhost';
export const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || '7350';
export const NAKAMA_USE_SSL = import.meta.env.VITE_NAKAMA_SSL === 'true';
export const SERVER_KEY = import.meta.env.VITE_NAKAMA_SERVER_KEY || 'defaultkey';

export const OpCode = {
  GAME_STATE: 1,
  MOVE_ACCEPTED: 2,
  MOVE_REJECTED: 3,
  GAME_OVER: 4,
  PLAYER_JOINED: 5,
  PLAYER_LEFT: 6,
  WAITING_FOR_OPPONENT: 7,
  TURN_TIMEOUT: 8,
  MAKE_MOVE: 101,
} as const;

export interface GameState {
  board: (string | null)[];
  currentTurn: string;
  playerX: string;
  playerO: string;
  playerXUsername: string;
  playerOUsername: string;
  status: 'waiting' | 'playing' | 'finished';
  winner: string | null;
  winningLine: number[] | null;
  moveCount: number;
  turnStartTime: number;
  reason?: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  wins: number;
  losses: number;
  winRate: number;
}

class NakamaClient {
  public client: Client;
  public session: Session | null = null;
  public socket: Socket | null = null;

  constructor() {
    this.client = new Client(SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_USE_SSL);
  }

  async authenticateDevice(deviceId: string, username: string): Promise<Session> {
    this.session = await this.client.authenticateDevice(deviceId, true, username);
    return this.session;
  }

  async createSocket(): Promise<Socket> {
    if (!this.session) throw new Error('Not authenticated');
    if (this.socket) return this.socket;
    this.socket = this.client.createSocket(NAKAMA_USE_SSL, false);
    await this.socket.connect(this.session, true);
    return this.socket;
  }

  async findMatch(): Promise<string> {
    if (!this.session) throw new Error('Not authenticated');
    const result = await this.client.rpc(this.session, 'find_match', {});
    const data = typeof result.payload === 'string' ? JSON.parse(result.payload) : result.payload;
    return data.matchId;
  }

  async createPrivateRoom(): Promise<{ matchId: string; code: string }> {
    if (!this.session) throw new Error('Not authenticated');
    const result = await this.client.rpc(this.session, 'create_private_room', {});
    const data = typeof result.payload === 'string' ? JSON.parse(result.payload) : result.payload;
    if (data.error) throw new Error(data.error);
    return data;
  }
  
  async joinByCode(code: string): Promise<string> {
    if (!this.session) throw new Error('Not authenticated');
    const result = await this.client.rpc(this.session, 'join_by_code', { code: code.toUpperCase() });
    const data = typeof result.payload === 'string' ? JSON.parse(result.payload) : result.payload;
    if (data.error) throw new Error(data.error);
    return data.matchId;
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    if (!this.session) throw new Error('Not authenticated');
    const result = await this.client.rpc(this.session, 'get_leaderboard', {});
    const data = typeof result.payload === 'string' ? JSON.parse(result.payload) : result.payload;
    return data.leaderboard || [];
  }

  async joinMatch(matchId: string) {
    if (!this.socket) throw new Error('Socket not connected');
    return await this.socket.joinMatch(matchId);
  }

  async leaveMatch(matchId: string) {
    if (!this.socket) return;
    try {
      await this.socket.leaveMatch(matchId);
    } catch (e) {}
  }

  sendMove(matchId: string, position: number) {
    if (!this.socket) throw new Error('Socket not connected');
    const data = new TextEncoder().encode(JSON.stringify({ position }));
    this.socket.sendMatchState(matchId, OpCode.MAKE_MOVE, data);
  }

  disconnect() {
    this.socket?.disconnect(false);
    this.socket = null;
    this.session = null;
  }
}

export const nakama = new NakamaClient();

export function getOrCreateDeviceId(): string {
  const key = 'ttt_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function getSavedUsername(): string | null {
  return localStorage.getItem('ttt_username');
}

export function saveUsername(username: string) {
  localStorage.setItem('ttt_username', username);
}