import type { SocketPlayer } from '../store/sessionStore';
import type { Player } from './session';

export type JoinRoomPayload = {
  sessionCode: string;
  playerName: string;
  avatar?: string | null;
};

export type LobbyUpdatePayload = {
  sessionCode: string;
  players: SocketPlayer[];
};

export type FinanceUpdatePayload = {
  sessionCode: string;
  players: Player[];
};

export type GameStartPayload = {
  sessionCode: string;
};
