import type { SocketPlayer } from '../store/sessionStore';

export type JoinRoomPayload = {
  sessionCode: string;
  playerName: string;
};

export type LobbyUpdatePayload = {
  sessionCode: string;
  players: SocketPlayer[];
};

export type GameStartPayload = {
  sessionCode: string;
};
