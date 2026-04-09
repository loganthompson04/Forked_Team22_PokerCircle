export type SessionStatus = 'waiting' | 'starting' | 'active' | 'finished';

export interface GameState {
  [key: string]: unknown;
}

export interface Player {
  playerId: string;
  /** In-memory socket store uses `name`; DB responses use `displayName`.
   *  Keep both optional so both code paths compile. */
  name?: string;
  displayName?: string;
  joinedAt: string;
  isReady: boolean;
  buyIn: number;
  rebuyTotal: number;
  cashOut: number;
  avatar?: string | null;
}

export interface Session {
  sessionCode: string;
  createdAt: string;
  hostUserId: string;
  status: SessionStatus;
  players: Player[];
}
