import pool from '../db/pool';
import type { Player, Session } from '../types/session';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeSessionCode(sessionCode: string): string {
  return sessionCode.trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionWithPlayers extends Session {}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch a session and its players (including financial columns).
 * Returns null if the session does not exist.
 */
export async function getSessionWithPlayers(
  sessionCode: string
): Promise<SessionWithPlayers | null> {
  const code = normalizeSessionCode(sessionCode);

  const sessionRes = await pool.query(
    `SELECT session_code, host_user_id, status, game_state, created_at,
            buy_in_amount, max_rebuys
     FROM game_sessions
     WHERE session_code = $1`,
    [code]
  );

  if ((sessionRes.rowCount ?? 0) === 0) return null;

  const playersRes = await pool.query(
    `SELECT sp.id, sp.display_name, sp.is_ready, sp.buy_in, sp.rebuy_total, sp.cash_out, sp.joined_at, u.avatar
     FROM session_players sp
     LEFT JOIN users u ON u.username = sp.display_name
     WHERE sp.session_code = $1
     ORDER BY sp.joined_at ASC`,
    [code]
  );

  const sessionRow = sessionRes.rows[0];

    return {
      sessionCode: sessionRow.session_code as string,
      hostUserId: sessionRow.host_user_id as string,
      status: sessionRow.status as Session['status'],
      gameState: (sessionRow.game_state as Session['gameState']) ?? {},
      createdAt: sessionRow.created_at as string,
      buyInAmount: (sessionRow.buy_in_amount as number) ?? 0,
      maxRebuys: (sessionRow.max_rebuys as number) ?? 0,
    players: playersRes.rows.map((r) => ({
      playerId: String(r.id),
      displayName: r.display_name as string,
      isReady: r.is_ready as boolean,
      buyIn: (r.buy_in as number) ?? 0,
      rebuyTotal: (r.rebuy_total as number) ?? 0,
      cashOut: (r.cash_out as number) ?? 0,
      joinedAt: r.joined_at as string,
      avatar: (r.avatar ?? null) as string | null,
    })),
  };
}

/**
 * Update one or more financial fields for a specific player in a session.
 * Only the provided fields are updated; omitted fields are left unchanged.
 * Returns true if a row was updated, false if the player / session was not found.
 */
export async function updatePlayerFinances(
  sessionCode: string,
  displayName: string,
  finances: { buyIn?: number; rebuyTotal?: number; cashOut?: number }
): Promise<boolean> {
  const code = normalizeSessionCode(sessionCode);
  const name = displayName.trim();

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (finances.buyIn !== undefined) {
    fields.push(`buy_in = $${paramIdx++}`);
    values.push(finances.buyIn);
  }
  if (finances.rebuyTotal !== undefined) {
    fields.push(`rebuy_total = $${paramIdx++}`);
    values.push(finances.rebuyTotal);
  }
  if (finances.cashOut !== undefined) {
    fields.push(`cash_out = $${paramIdx++}`);
    values.push(finances.cashOut);
  }

  if (fields.length === 0) return false;

  values.push(code, name);

  const query = `
    UPDATE session_players
    SET ${fields.join(', ')}
    WHERE session_code = $${paramIdx++} AND display_name = $${paramIdx++}
  `;

  const result = await pool.query(query, values);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Update a session's status column.
 * Returns the updated row or null if not found.
 */
export async function updateSessionStatus(
  sessionCode: string,
  status: Session['status']
): Promise<SessionWithPlayers | null> {
  const code = normalizeSessionCode(sessionCode);

  await pool.query(
    `UPDATE game_sessions SET status = $1 WHERE session_code = $2`,
    [status, code]
  );

  return getSessionWithPlayers(code);
}

/**
 * Insert a new player row.  Returns the updated session, or null if the
 * session does not exist.
 */
export async function addPlayerToSession(
  sessionCode: string,
  displayName: string
): Promise<SessionWithPlayers | null> {
  const code = normalizeSessionCode(sessionCode);
  const name = displayName.trim();

  const existsRes = await pool.query(
    'SELECT 1 FROM game_sessions WHERE session_code = $1',
    [code]
  );
  if ((existsRes.rowCount ?? 0) === 0) return null;

  await pool.query(
    'INSERT INTO session_players (session_code, display_name) VALUES ($1, $2)',
    [code, name]
  );

  return getSessionWithPlayers(code);
}

/**
 * Update the is_ready flag for a player.
 */
export async function updatePlayerReady(
  sessionCode: string,
  displayName: string,
  isReady: boolean
): Promise<boolean> {
  const code = normalizeSessionCode(sessionCode);

  const result = await pool.query(
    `UPDATE session_players SET is_ready = $1
     WHERE session_code = $2 AND display_name = $3`,
    [isReady, code, displayName.trim()]
  );

  return (result.rowCount ?? 0) > 0;
}
