/**
 * In-memory session store for Socket.IO room state.
 *
 * This is intentionally kept lightweight — it only tracks what the
 * socket layer needs (ready state, player identity) and is NOT the
 * source of truth for financial data.  Financial data lives in the DB
 * and is accessed via sessionDbStore.
 */

// ---------------------------------------------------------------------------
// Types — deliberately separate from the DB types in ../types/session.ts
// so the socket store doesn't drag in DB-only fields.
// ---------------------------------------------------------------------------

export interface SocketPlayer {
  playerId: string; // socket.id
  name: string;
  isReady: boolean;
  avatar?: string | null;
}

export interface SocketSession {
  sessionCode: string;
  createdAt: string;
  hostUserId?: string;
  players: SocketPlayer[];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const sessions = new Map<string, SocketSession>();

function normalizeSessionCode(sessionCode: string): string {
  return sessionCode.trim().toUpperCase();
}

export function hasSession(sessionCode: string): boolean {
  return sessions.has(normalizeSessionCode(sessionCode));
}

export function createSession(session: SocketSession): void {
  const code = normalizeSessionCode(session.sessionCode);
  sessions.set(code, { ...session, sessionCode: code });
}

export function getSession(sessionCode: string): SocketSession | null {
  return sessions.get(normalizeSessionCode(sessionCode)) ?? null;
}

export function addPlayer(sessionCode: string, player: SocketPlayer): boolean {
  const code = normalizeSessionCode(sessionCode);
  const session = sessions.get(code);
  if (!session) return false;
  session.players.push({ ...player, isReady: player.isReady ?? false });
  return true;
}

export function setPlayerReadyByName(
  sessionCode: string,
  name: string,
  isReady: boolean
): boolean {
  const code = normalizeSessionCode(sessionCode);
  const session = sessions.get(code);
  if (!session) return false;
  const player = session.players.find((p) => p.name === name);
  if (!player) return false;
  player.isReady = isReady;
  return true;
}

export function removePlayer(sessionCode: string, playerId: string): void {
  const code = normalizeSessionCode(sessionCode);
  const session = sessions.get(code);
  if (!session) return;
  session.players = session.players.filter((p) => p.playerId !== playerId);
}

export function getSessionCount(): number {
  return sessions.size;
}
