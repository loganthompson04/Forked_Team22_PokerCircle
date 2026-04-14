import { Router } from "express";
import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import pool from "../db/pool";

const router = Router();

// GET /api/users/:userId/stats
// Returns aggregated all-time stats for a user from finished sessions
router.get(
  "/:userId/stats",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT
        COUNT(*)::int AS "sessionsPlayed",
        COALESCE(SUM(sp.cash_out - sp.buy_in - sp.rebuy_total), 0) AS "totalNet",
        COALESCE(MAX(sp.cash_out - sp.buy_in - sp.rebuy_total), 0) AS "biggestWin",
        COALESCE(MIN(sp.cash_out - sp.buy_in - sp.rebuy_total), 0) AS "biggestLoss"
      FROM session_players sp
      JOIN game_sessions gs ON gs.session_code = sp.session_code
      JOIN users u ON u.username = sp.display_name AND u.user_id = $1
      WHERE gs.status = 'finished'`,
      [userId]
    );

    const row = result.rows[0];
    res.json({
      stats: {
        sessionsPlayed: row.sessionsPlayed,
        totalNet: parseFloat(row.totalNet),
        biggestWin: parseFloat(row.biggestWin),
        biggestLoss: parseFloat(row.biggestLoss),
      },
    });
  })
);

// GET /api/users/:userId/sessions
// Returns list of finished sessions the user participated in
router.get(
  "/:userId/sessions",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT
        gs.session_code AS "sessionCode",
        gs.created_at AS "date",
        (sp.cash_out - sp.buy_in - sp.rebuy_total) AS "net",
        (SELECT COUNT(*)::int FROM session_players WHERE session_code = gs.session_code) AS "playerCount"
      FROM session_players sp
      JOIN game_sessions gs ON gs.session_code = sp.session_code
      JOIN users u ON u.username = sp.display_name AND u.user_id = $1
      WHERE gs.status = 'finished'
      ORDER BY gs.created_at DESC`,
      [userId]
    );

    res.json({
      sessions: result.rows.map((row: { sessionCode: string; date: Date | string; net: string; playerCount: number }) => ({
        sessionCode: row.sessionCode,
        date: row.date instanceof Date ? row.date.toISOString() : row.date,
        net: parseFloat(row.net),
        playerCount: row.playerCount,
      })),
    });
  })
);

// GET /api/users/:userId/leaderboard
// Returns net results for the user and their accepted friends ranked by all-time net winnings
router.get(
  "/:userId/leaderboard",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (String(req.session.userId) !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const query = `
      WITH friend_ids AS (
        SELECT
          CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS u_id
        FROM friendships
        WHERE (requester_id = $1 OR addressee_id = $1)
          AND status = 'accepted'
        UNION
        SELECT $1::uuid AS u_id
      )
      SELECT
        u.username AS "displayName",
        u.avatar,
        COALESCE(SUM(sp.cash_out - sp.buy_in - sp.rebuy_total), 0)::float AS "netResult"
      FROM friend_ids fi
      JOIN users u ON u.user_id = fi.u_id
      LEFT JOIN session_players sp ON sp.display_name = u.username
      LEFT JOIN game_sessions gs ON gs.session_code = sp.session_code AND gs.status = 'finished'
      GROUP BY u.user_id, u.username, u.avatar
      ORDER BY "netResult" DESC
    `;

    const result = await pool.query(query, [userId]);

    res.json({
      leaderboard: result.rows.map(row => ({
        ...row,
        netResult: parseFloat(row.netResult)
      })),
    });
  })
);

// PATCH /api/users/:userId/displayname
// Updates the display name (username) for a user
router.patch(
  "/:userId/displayname",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { newName } = req.body;

    if (!newName || String(newName).trim() === "") {
      res.status(400).json({ error: "Display name is required" });
      return;
    }

    if (String(req.session.userId) !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    try {
      const result = await pool.query(
        `UPDATE users SET username = $1 WHERE user_id = $2 RETURNING username`,
        [newName.trim(), userId]
      );
      res.json({ username: result.rows[0].username });
    } catch (err: any) {
      if (err.code === "23505") {
        res.status(409).json({ error: "Username already taken" });
        return;
      }
      throw err;
    }
  })
);

// PATCH /api/users/:userId/avatar
router.patch(
  '/:userId/avatar',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { avatarId } = req.body;

    const VALID_IDS = new Set([
      'red-spade', 'red-heart', 'red-diamond', 'red-club',
      'blue-spade', 'blue-heart', 'blue-diamond', 'blue-club',
      'green-spade', 'green-heart', 'green-diamond', 'green-club',
      'purple-spade', 'purple-heart', 'purple-diamond', 'purple-club',
    ]);

    if (!avatarId || !VALID_IDS.has(String(avatarId))) {
      res.status(400).json({ error: 'Invalid avatar ID' });
      return;
    }

    if (String(req.session.userId) !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const result = await pool.query(
      `UPDATE users SET avatar = $1 WHERE user_id = $2 RETURNING avatar`,
      [avatarId, userId]
    );

    res.json({ avatar: result.rows[0].avatar });
  })
);

export default router;

