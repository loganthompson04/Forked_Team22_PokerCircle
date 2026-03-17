import { Player, Session } from "../types/session";

const sessions = new Map<string, Session>();

function normalizeSessionCode(sessionCode: string): string {
  return sessionCode.trim().toUpperCase();
}

export function hasSession(sessionCode: string): boolean {
  return sessions.has(normalizeSessionCode(sessionCode));
}

export function createSession(session: Session): void {
  const code = normalizeSessionCode(session.sessionCode);
  sessions.set(code, { ...session, sessionCode: code });
}

export function getSession(sessionCode: string): Session | null {
  return sessions.get(normalizeSessionCode(sessionCode)) ?? null;
}

export function addPlayer(sessionCode: string, player: Player): boolean {
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