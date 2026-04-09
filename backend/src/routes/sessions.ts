import { Router, Request, Response } from 'express';
import asyncHandler from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/requireAuth';
import pool from '../db/pool';
import { generateSessionCode } from '../utils/sessionCode';
import type { Server } from 'socket.io';
import { setPlayerReadyByName, getSession } from '../store/sessionStore';
import type { LobbyUpdatePayload, FinanceUpdatePayload } from '../types/socketEvents';
import type { SessionInvite } from '../types/invite';
import {
  getSessionWithPlayers,
  updateSessionStatus,
  updatePlayerFinances,
} from '../store/sessionDbStore';

const router = Router();

// ---------------------------------------------------------------------------
// Helper — maps a raw DB row to a full Player object
// Used anywhere we do an inline query that joins session_players.
// ---------------------------------------------------------------------------
function mapPlayerRow(r: Record<string, unknown>) {
  return {
    playerId:    String(r['playerId']    ?? r['id']),
    displayName: r['displayName']        as string,
    joinedAt:    r['joinedAt']           as string,
    isReady:     (r['isReady'] as boolean) ?? false,
    buyIn:       (r['buyIn']    as number) ?? 0,
    rebuyTotal:  (r['rebuyTotal'] as number) ?? 0,
    cashOut:     (r['cashOut']  as number) ?? 0,
    avatar:      (r['avatar']   ?? null)  as string | null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/sessions
// ---------------------------------------------------------------------------
router.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'sessions route reachable' });
});

// ---------------------------------------------------------------------------
// POST /api/sessions — create a new session
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const hostUserId = req.session.userId!;
    const { buyInAmount = 0, maxRebuys = 0 } = req.body as {
      buyInAmount?: number;
      maxRebuys?: number;
    };
    let attempts = 0;

    while (attempts < 20) {
      const sessionCode = generateSessionCode(6);
      try {
        const result = await pool.query(
          `INSERT INTO game_sessions (session_code, host_user_id, buy_in_amount, max_rebuys)
           VALUES ($1, $2, $3, $4)
           RETURNING session_code, created_at, host_user_id, buy_in_amount, max_rebuys;`,
          [sessionCode, hostUserId, buyInAmount, maxRebuys]
        );
        const row = result.rows[0];
        return res.status(201).json({
          sessionCode: row.session_code,
          createdAt: row.created_at,
          hostUserId: row.host_user_id,
          buyInAmount: row.buy_in_amount,
          maxRebuys: row.max_rebuys,
          players: [],
        });
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === '23505') { attempts++; continue; }
        throw err;
      }
    }
    return res.status(500).json({ error: 'Failed to generate unique session code' });
  })
);

// ---------------------------------------------------------------------------
// GET /api/sessions/:sessionCode
// ---------------------------------------------------------------------------
router.get(
  '/:sessionCode',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionCode = (req.params as { sessionCode: string }).sessionCode;

    const result = await pool.query(
      `SELECT
         gs.session_code    AS "sessionCode",
         gs.created_at      AS "createdAt",
         gs.host_user_id    AS "hostUserId",
         gs.status,
         gs.buy_in_amount    AS "buyInAmount",
         gs.max_rebuys      AS "maxRebuys",
         p.id               AS "playerId",
         p.display_name     AS "displayName",
         p.joined_at        AS "joinedAt",
         p.is_ready         AS "isReady",
         p.buy_in           AS "buyIn",
         p.rebuy_total      AS "rebuyTotal",
         p.cash_out         AS "cashOut",
         u.avatar           AS "avatar"
       FROM game_sessions gs
       LEFT JOIN session_players p ON p.session_code = gs.session_code
       LEFT JOIN users u ON u.username = p.display_name
       WHERE gs.session_code = $1
       ORDER BY p.joined_at ASC NULLS LAST;`,
      [sessionCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const first = result.rows[0];
    const players = result.rows
      .filter((r) => r['playerId'] !== null)
      .map(mapPlayerRow);

    return res.status(200).json({
      sessionCode: first['sessionCode'],
      createdAt: first['createdAt'],
      hostUserId: first['hostUserId'],
      status: first['status'],
      players,
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/sessions/:sessionCode/players
// ---------------------------------------------------------------------------
router.get(
  '/:sessionCode/players',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionCode } = req.params as { sessionCode: string };

    const session = await getSessionWithPlayers(sessionCode);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.status(200).json(session.players);
  })
);

// ---------------------------------------------------------------------------
// POST /api/sessions/:sessionCode/join
// ---------------------------------------------------------------------------
router.post(
  '/:sessionCode/join',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionCode = (req.params as { sessionCode: string }).sessionCode;
    const { displayName } = req.body as { displayName?: string };

    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: 'displayName is required' });
    }

    const sessionResult = await pool.query(
      'SELECT session_code FROM game_sessions WHERE session_code = $1',
      [sessionCode]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    try {
      await pool.query(
        'INSERT INTO session_players (session_code, display_name) VALUES ($1, $2)',
        [sessionCode, displayName.trim()]
      );
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === '23505') {
        return res.status(409).json({ error: 'Player name already exists in this session' });
      }
      throw err;
    }

    const stateResult = await pool.query(
      `SELECT
         gs.session_code    AS "sessionCode",
         gs.created_at      AS "createdAt",
         gs.host_user_id    AS "hostUserId",
         p.id               AS "playerId",
         p.display_name     AS "displayName",
         p.joined_at        AS "joinedAt",
         p.is_ready         AS "isReady",
         p.buy_in           AS "buyIn",
         p.rebuy_total      AS "rebuyTotal",
         p.cash_out         AS "cashOut",
         u.avatar           AS "avatar"
       FROM game_sessions gs
       LEFT JOIN session_players p ON p.session_code = gs.session_code
       LEFT JOIN users u ON u.username = p.display_name
       WHERE gs.session_code = $1
       ORDER BY p.joined_at ASC NULLS LAST;`,
      [sessionCode]
    );

    const first = stateResult.rows[0];
    const players = stateResult.rows
      .filter((r) => r['playerId'] !== null)
      .map(mapPlayerRow);

    return res.status(200).json({
      sessionCode: first['sessionCode'],
      createdAt: first['createdAt'],
      hostUserId: first['hostUserId'],
      players,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/sessions/:sessionCode/ready
// ---------------------------------------------------------------------------
router.post(
  '/:sessionCode/ready',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionCode = (req.params as { sessionCode: string }).sessionCode;
    const { displayName, isReady } = req.body as { displayName?: string; isReady?: boolean };

    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: 'displayName is required' });
    }
    if (typeof isReady !== 'boolean') {
      return res.status(400).json({ error: 'isReady must be a boolean' });
    }

    const cleanName: string = displayName.trim();
    const readyValue: boolean = isReady;

    const result = await pool.query(
      'UPDATE session_players SET is_ready = $1 WHERE session_code = $2 AND display_name = $3',
      [readyValue, sessionCode, cleanName]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Player not found in session' });
    }

    setPlayerReadyByName(sessionCode, cleanName, readyValue);

    const session = getSession(sessionCode);
    const io: Server = req.app.get('io');
    const payload: LobbyUpdatePayload = {
      sessionCode,
      players: session?.players ?? [],
    };
    io.to(sessionCode).emit('lobby:update', payload);

    return res.status(200).json({ sessionCode, displayName: cleanName, isReady: readyValue });
  })
);

// ---------------------------------------------------------------------------
// POST /api/sessions/:sessionCode/start  (host only)
// ---------------------------------------------------------------------------
router.post(
  '/:sessionCode/start',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionCode = (req.params as { sessionCode: string }).sessionCode;

    const result = await pool.query(
      `SELECT
         gs.host_user_id  AS "hostUserId",
         gs.status,
         u.username       AS "hostUsername",
         p.display_name   AS "displayName",
         p.is_ready       AS "isReady"
       FROM game_sessions gs
       JOIN users u ON u.user_id = gs.host_user_id
       LEFT JOIN session_players p ON p.session_code = gs.session_code
       WHERE gs.session_code = $1`,
      [sessionCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (result.rows[0]['hostUserId'] !== req.session.userId) {
      return res.status(403).json({ error: 'Only the host can start the game' });
    }

    const players = result.rows.filter((r) => r['displayName'] !== null);

    if (players.length < 2) {
      return res.status(400).json({ error: 'At least 2 players are required to start the game' });
    }

    const hostUsername = result.rows[0]['hostUsername'] as string;

    const notReady = players.filter(
      (p) => !p['isReady'] && p['displayName'] !== hostUsername
    );

    if (notReady.length > 0) {
      return res.status(400).json({
        error: `Not all players are ready (${notReady.map((p) => p['displayName'] as string).join(', ')})`,
      });
    }

    await pool.query(
      "UPDATE game_sessions SET status = 'active' WHERE session_code = $1",
      [sessionCode]
    );

    const io: Server = req.app.get('io');
    io.to(sessionCode).emit('game:start', { sessionCode });

    return res.status(200).json({ message: 'Game started', sessionCode });
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/sessions/:sessionCode/players/:displayName/finances  (TM22-87)
// ---------------------------------------------------------------------------
router.patch(
  '/:sessionCode/players/:displayName/finances',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionCode, displayName } = req.params as {
      sessionCode: string;
      displayName: string;
    };
    const body = req.body as {
      buyIn?: number;
      rebuyTotal?: number;
      cashOut?: number;
    };

    // exactOptionalPropertyTypes: true means we cannot pass `undefined` explicitly —
    // only include keys that are actually present in the request body.
    const finances: { buyIn?: number; rebuyTotal?: number; cashOut?: number } = {};
    if (body.buyIn      !== undefined) finances.buyIn      = body.buyIn;
    if (body.rebuyTotal !== undefined) finances.rebuyTotal = body.rebuyTotal;
    if (body.cashOut    !== undefined) finances.cashOut    = body.cashOut;
    
    // Enforce max rebuys if set
    if (finances.rebuyTotal !== undefined && finances.rebuyTotal > 0) {
      const limitsResult = await pool.query(
        `SELECT gs.max_rebuys, gs.buy_in_amount
         FROM game_sessions gs
         WHERE gs.session_code = $1`,
        [sessionCode]
      );
      const maxRebuys: number = limitsResult.rows[0]?.max_rebuys ?? 0;
      const buyInAmount: number = limitsResult.rows[0]?.buy_in_amount ?? 0;
    
      if (maxRebuys > 0 && buyInAmount > 0) {
        const impliedCount = Math.round(finances.rebuyTotal / buyInAmount);
        if (impliedCount > maxRebuys) {
          return res.status(400).json({
            error: `Max rebuys is ${maxRebuys}. You cannot exceed that limit.`,
          });
        }
      }
    }

    const success = await updatePlayerFinances(sessionCode, displayName, finances);

    if (!success) {
      return res.status(404).json({ error: 'Player or session not found' });
    }

    const session = await getSessionWithPlayers(sessionCode);
    if (session) {
      const io: Server = req.app.get('io');
      const payload: FinanceUpdatePayload = {
        sessionCode,
        players: session.players,
      };
      io.to(sessionCode).emit('finance:update', payload);
    }

    return res.status(200).json({
      message: 'Player finances updated',
      sessionCode,
      displayName,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/sessions/:sessionCode/complete  (host only — TM22-87/88)
// ---------------------------------------------------------------------------
router.post(
  '/:sessionCode/complete',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionCode } = req.params as { sessionCode: string };

    const session = await getSessionWithPlayers(sessionCode);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.hostUserId !== req.session.userId) {
      return res.status(403).json({ error: 'Only the host can complete the session' });
    }

    const updatedSession = await updateSessionStatus(sessionCode, 'finished');

    const io: Server = req.app.get('io');
    io.to(sessionCode).emit('game:complete', { sessionCode });

    return res.status(200).json(updatedSession);
  })
);

// ---------------------------------------------------------------------------
// GET /api/sessions/:sessionCode/results  (TM22-87/88)
// ---------------------------------------------------------------------------
router.get(
  '/:sessionCode/results',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionCode } = req.params as { sessionCode: string };

    const session = await getSessionWithPlayers(sessionCode);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { calculateSettlement } = await import('../utils/settlement');

    try {
      const results = calculateSettlement(session.players);
      return res.status(200).json(results);
    } catch (err: unknown) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Settlement calculation failed',
      });
    }
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/sessions/:sessionCode/status
// ---------------------------------------------------------------------------
router.patch(
  '/:sessionCode/status',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionCode } = req.params as { sessionCode: string };
    const { status } = req.body as { status?: string };

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const updatedSession = await updateSessionStatus(
      sessionCode,
      status as 'waiting' | 'starting' | 'active' | 'finished'
    );

    if (!updatedSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.status(200).json(updatedSession);
  })
);

// ---------------------------------------------------------------------------
// POST /api/sessions/:sessionCode/invite  (host only)
// ---------------------------------------------------------------------------
router.post(
  '/:sessionCode/invite',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionCode } = req.params as { sessionCode: string };
    const { inviteeId } = req.body as { inviteeId?: string };
    const hostUserId = req.session.userId!;

    if (!inviteeId || inviteeId.trim().length === 0) {
      return res.status(400).json({ error: 'inviteeId is required' });
    }

    const sessionResult = await pool.query(
      'SELECT session_code, host_user_id, status FROM game_sessions WHERE session_code = $1',
      [sessionCode]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const sessionRow = sessionResult.rows[0];
    if (sessionRow['status'] === 'active') {
      return res.status(400).json({ error: 'Game has already started' });
    }
    if (sessionRow['host_user_id'] !== hostUserId) {
      return res.status(403).json({ error: 'Only the host can send invites' });
    }

    const inviteeResult = await pool.query(
      'SELECT user_id FROM users WHERE user_id = $1',
      [inviteeId]
    );
    if (inviteeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invitee not found' });
    }

    const friendshipResult = await pool.query(
      `SELECT id FROM friendships
       WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
         AND status = 'accepted'`,
      [hostUserId, inviteeId]
    );
    if (friendshipResult.rows.length === 0) {
      return res.status(403).json({ error: 'You can only invite friends' });
    }

    const playerResult = await pool.query(
      `SELECT id FROM session_players WHERE session_code = $1 AND display_name = (
         SELECT username FROM users WHERE user_id = $2
       )`,
      [sessionCode, inviteeId]
    );
    if (playerResult.rows.length > 0) {
      return res.status(409).json({ error: 'User is already in the session' });
    }

    const insertResult = await pool.query<SessionInvite>(
      `INSERT INTO session_invites (session_code, inviter_id, invitee_id)
       VALUES ($1, $2, $3)
       ON CONFLICT ON CONSTRAINT unique_invite
         DO UPDATE SET status = 'pending', created_at = NOW()
         WHERE session_invites.status IN ('declined', 'accepted')
       RETURNING
         id,
         session_code AS "sessionCode",
         inviter_id   AS "inviterId",
         invitee_id   AS "inviteeId",
         status,
         created_at   AS "createdAt"`,
      [sessionCode, hostUserId, inviteeId]
    );

    let invite: SessionInvite;
    let isNew = true;

    if (insertResult.rows.length === 0) {
      const existingResult = await pool.query<SessionInvite>(
        `SELECT id, session_code AS "sessionCode", inviter_id AS "inviterId",
                invitee_id AS "inviteeId", status, created_at AS "createdAt"
         FROM session_invites
         WHERE session_code = $1 AND invitee_id = $2`,
        [sessionCode, inviteeId]
      );
      if (existingResult.rows.length === 0) {
        return res.status(409).json({ error: 'Already invited' });
      }
      invite = existingResult.rows[0] as SessionInvite;
      isNew = false;
    } else {
      invite = insertResult.rows[0] as SessionInvite;
    }

    const io: Server = req.app.get('io');
    const inviterResult = await pool.query(
      'SELECT username FROM users WHERE user_id = $1',
      [hostUserId]
    );
    const inviterUsername: string = inviterResult.rows[0]?.username ?? 'Unknown';
    io.to(`user:${inviteeId}`).emit('user:invite', { ...invite, inviterUsername });

    return res.status(isNew ? 201 : 200).json({ ...invite, inviterUsername });
  })
);

export default router;
