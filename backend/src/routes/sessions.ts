import { Router, Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import pool from "../db/pool";
import { generateSessionCode } from "../utils/sessionCode";
import type { Server } from "socket.io";
import { setPlayerReadyByName, getSession } from "../store/sessionStore";
import type { LobbyUpdatePayload } from "../types/socketEvents";
import type { SessionInvite } from "../types/invite";


const router = Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", message: "sessions route reachable" });
});

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const hostUserId = req.session.userId!;
    let attempts = 0;

    while (attempts < 20) {
      const sessionCode = generateSessionCode(6);

      try {
        const result = await pool.query(
          `
          INSERT INTO game_sessions (session_code, host_user_id)
          VALUES ($1, $2)
          RETURNING session_code, created_at, host_user_id;
          `,
          [sessionCode, hostUserId]
        );

        const row = result.rows[0];

        return res.status(201).json({
          sessionCode: row.session_code,
          createdAt: row.created_at,
          hostUserId: row.host_user_id,
          players: [],
        });
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === "23505") {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    return res.status(500).json({ error: "Failed to generate unique session code" });
  })
);

router.get(
  "/:sessionCode",
  asyncHandler(async (req: Request, res: Response) => {
    const sessionCode = (req.params as { sessionCode: string }).sessionCode;

    const result = await pool.query(
      `
      SELECT
        gs.session_code  AS "sessionCode",
        gs.created_at    AS "createdAt",
        gs.host_user_id  AS "hostUserId",
        p.id             AS "playerId",
        p.display_name   AS "displayName",
        p.joined_at      AS "joinedAt",
        p.is_ready       AS "isReady"
      FROM game_sessions gs
      LEFT JOIN session_players p ON p.session_code = gs.session_code
      WHERE gs.session_code = $1
      ORDER BY p.joined_at ASC NULLS LAST;
      `,
      [sessionCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const first = result.rows[0];

    const players = result.rows
      .filter((r) => r.playerId !== null)
      .map((r) => ({
        playerId: String(r.playerId),
        displayName: r.displayName,
        joinedAt: r.joinedAt,
        isReady: r.isReady,
      }));

    return res.status(200).json({
      sessionCode: first.sessionCode,
      createdAt: first.createdAt,
      hostUserId: first.hostUserId,
      players,
    });
  })
);

router.post(
  "/:sessionCode/join",
  asyncHandler(async (req: Request, res: Response) => {
    const sessionCode = (req.params as { sessionCode: string }).sessionCode;
    const { displayName } = req.body as { displayName?: string };

    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: "displayName is required" });
    }

    const sessionResult = await pool.query(
      `SELECT session_code, created_at, host_user_id FROM game_sessions WHERE session_code = $1`,
      [sessionCode]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    try {
      await pool.query(
        `INSERT INTO session_players (session_code, display_name) VALUES ($1, $2)`,
        [sessionCode, displayName.trim()]
      );
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === "23505") {
        return res.status(409).json({ error: "Player name already exists in this session" });
      }
      throw err;
    }

    const stateResult = await pool.query(
      `
      SELECT
        gs.session_code  AS "sessionCode",
        gs.created_at    AS "createdAt",
        gs.host_user_id  AS "hostUserId",
        p.id             AS "playerId",
        p.display_name   AS "displayName",
        p.joined_at      AS "joinedAt",
        p.is_ready       AS "isReady"
      FROM game_sessions gs
      LEFT JOIN session_players p ON p.session_code = gs.session_code
      WHERE gs.session_code = $1
      ORDER BY p.joined_at ASC NULLS LAST;
      `,
      [sessionCode]
    );

    const first = stateResult.rows[0];

    const players = stateResult.rows
      .filter((r) => r.playerId !== null)
      .map((r) => ({
        playerId: String(r.playerId),
        displayName: r.displayName,
        joinedAt: r.joinedAt,
        isReady: r.isReady,
      }));

    return res.status(200).json({
      sessionCode: first.sessionCode,
      createdAt: first.createdAt,
      hostUserId: first.hostUserId,
      players,
    });
  })
);

router.post(
  "/:sessionCode/ready",
  asyncHandler(async (req: Request, res: Response) => {
    const sessionCode = (req.params as { sessionCode: string }).sessionCode;
    const { displayName, isReady } = req.body as { displayName?: string; isReady?: boolean };

    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: "displayName is required" });
    }
    if (typeof isReady !== "boolean") {
      return res.status(400).json({ error: "isReady must be a boolean" });
    }

    const cleanName: string = displayName.trim();
    const readyValue: boolean = isReady;

    const result = await pool.query(
      `UPDATE session_players SET is_ready = $1 WHERE session_code = $2 AND display_name = $3`,
      [readyValue, sessionCode, cleanName]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Player not found in session" });
    }

    setPlayerReadyByName(sessionCode, cleanName, readyValue);

    const session = getSession(sessionCode);
    const io: Server = req.app.get("io");
    const payload: LobbyUpdatePayload = {
      sessionCode,
      players: session?.players ?? [],
    };
    io.to(sessionCode).emit("lobby:update", payload);

    return res.status(200).json({ sessionCode, displayName: cleanName, isReady: readyValue });
  })
);

router.post(
  "/:sessionCode/start",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionCode = (req.params as { sessionCode: string }).sessionCode;

    // 1. Fetch session + players in one query
    const result = await pool.query(
      `
      SELECT
        gs.host_user_id AS "hostUserId",
        gs.status,
        p.display_name  AS "displayName",
        p.is_ready      AS "isReady"
      FROM game_sessions gs
      LEFT JOIN session_players p ON p.session_code = gs.session_code
      WHERE gs.session_code = $1
      `,
      [sessionCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    // 2. Host-only check
    if (result.rows[0].hostUserId !== req.session.userId) {
      return res.status(403).json({ error: "Only the host can start the game" });
    }

    // 3. Build player list (filter out null row from LEFT JOIN when no players)
    const players = result.rows.filter((r) => r.displayName !== null);

    // 4. Minimum player count check
    if (players.length < 2) {
      return res.status(400).json({ error: "At least 2 players are required to start the game" });
    }

    // 5. All players must be ready
    const notReady = players.filter((p) => !p.isReady);
    if (notReady.length > 0) {
      return res.status(400).json({
        error: `Not all players are ready (${notReady.map((p) => p.displayName).join(", ")})`,
      });
    }

    // 6. Update session status in DB
    await pool.query(
      `UPDATE game_sessions SET status = 'active' WHERE session_code = $1`,
      [sessionCode]
    );

    // 7. Emit game:start to all clients in the room
    const io: Server = req.app.get("io");
    io.to(sessionCode).emit("game:start", { sessionCode });

    return res.status(200).json({ message: "Game started", sessionCode });
  })
);

router.post(
  "/:sessionCode/invite",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionCode } = req.params as { sessionCode: string };
    const { inviteeId } = req.body as { inviteeId?: string };
    const hostUserId = req.session.userId!;

    // 1. Validate inviteeId is present
    if (!inviteeId || inviteeId.trim().length === 0) {
      return res.status(400).json({ error: "inviteeId is required" });
    }

    // 2. Fetch session and validate it exists and hasn't started
    const sessionResult = await pool.query(
      `SELECT session_code, host_user_id, status FROM game_sessions WHERE session_code = $1`,
      [sessionCode]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }
    const session = sessionResult.rows[0];
    if (session.status === "active") {
      return res.status(400).json({ error: "Game has already started" });
    }

    // 3. Verify caller is the host
    if (session.host_user_id !== hostUserId) {
      return res.status(403).json({ error: "Only the host can send invites" });
    }

    // 4. Verify invitee exists
    const inviteeResult = await pool.query(
      `SELECT user_id FROM users WHERE user_id = $1`,
      [inviteeId]
    );
    if (inviteeResult.rows.length === 0) {
      return res.status(404).json({ error: "Invitee not found" });
    }

    // 5. Verify accepted friendship in either direction
    const friendshipResult = await pool.query(
      `
      SELECT id FROM friendships
      WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
        AND status = 'accepted'
      `,
      [hostUserId, inviteeId]
    );
    if (friendshipResult.rows.length === 0) {
      return res.status(403).json({ error: "You can only invite friends" });
    }

    // 6. Verify invitee is not already a player in the session
    const playerResult = await pool.query(
      `SELECT id FROM session_players WHERE session_code = $1 AND display_name = (
        SELECT username FROM users WHERE user_id = $2
      )`,
      [sessionCode, inviteeId]
    );
    if (playerResult.rows.length > 0) {
      return res.status(409).json({ error: "User is already in the session" });
    }

    // 7. Insert or re-activate invite; if already pending, fetch existing to re-notify
    const insertResult = await pool.query<SessionInvite>(
      `
      INSERT INTO session_invites (session_code, inviter_id, invitee_id)
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
        created_at   AS "createdAt"
      `,
      [sessionCode, hostUserId, inviteeId]
    );

    // If no rows returned the invite is already pending — fetch it to re-emit the notification
    let invite: SessionInvite;
    let isNew = true;
    if (insertResult.rows.length === 0) {
      const existingResult = await pool.query<SessionInvite>(
        `
        SELECT id, session_code AS "sessionCode", inviter_id AS "inviterId",
               invitee_id AS "inviteeId", status, created_at AS "createdAt"
        FROM session_invites
        WHERE session_code = $1 AND invitee_id = $2
        `,
        [sessionCode, inviteeId]
      );
      if (existingResult.rows.length === 0) {
        return res.status(409).json({ error: "Already invited" });
      }
      invite = existingResult.rows[0] as SessionInvite;
      isNew = false;
    } else {
      invite = insertResult.rows[0] as SessionInvite;
    }

    // 8. Emit real-time notification to the invitee's user room
    const io: Server = req.app.get("io");
    const inviterResult = await pool.query(
      `SELECT username FROM users WHERE user_id = $1`,
      [hostUserId]
    );
    const inviterUsername: string = inviterResult.rows[0]?.username ?? "Unknown";
    io.to(`user:${inviteeId}`).emit("user:invite", { ...invite, inviterUsername });

    return res.status(isNew ? 201 : 200).json({ ...invite, inviterUsername });
  })
);

export default router;
