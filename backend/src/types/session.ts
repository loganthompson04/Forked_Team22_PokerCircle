export type SessionStatus = 'waiting' | 'starting' | 'active' | 'finished';

export interface GameState {
  // To be expanded as game logic is implemented
  [key: string]: unknown;
}

export interface Player {
  playerId: string;
  displayName: string;
  joinedAt: string;
  isReady: boolean;
  /** Initial buy-in amount in cents (or whole dollar units — match your DB convention) */
  buyIn: number;
  /** Cumulative rebuy total */
  rebuyTotal: number;
  /** Final cash-out amount */
  cashOut: number;
}

export interface Session {
  sessionCode: string;
  hostUserId: string;
  status: SessionStatus;
  gameState: GameState;
  createdAt: string;
  buyInAmount: number;
  maxRebuys: number;
  players: Player[];
}
