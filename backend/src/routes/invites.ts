import { Router } from "express";
import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import pool from "../db/pool";
import type { SessionInvite } from "../types/invite";

const router = Router();

router.get(
  "/pending",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.session.userId!;

    const result = await pool.query<SessionInvite>(
      `
      SELECT
        si.id,
        si.session_code  AS "sessionCode",
        si.inviter_id    AS "inviterId",
        u.username       AS "inviterUsername",
        si.invitee_id    AS "inviteeId",
        si.status,
        si.created_at    AS "createdAt"
      FROM session_invites si
      JOIN users u ON u.user_id = si.inviter_id
      JOIN game_sessions gs ON gs.session_code = si.session_code
      WHERE si.invitee_id = $1 AND si.status = 'pending' AND gs.status = 'lobby'
      ORDER BY si.created_at DESC
      `,
      [userId]
    );

    res.set('Cache-Control', 'no-store');
    return res.json({ invites: result.rows });
  })
);

router.post(
  "/:id/respond",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const inviteId = parseInt((req.params as { id: string }).id, 10);
    const { action } = req.body as { action?: string };
    const userId = req.session.userId!;

    if (action !== "accept" && action !== "decline") {
      return res.status(400).json({ error: "action must be 'accept' or 'decline'" });
    }

    // Fetch invite
    const inviteResult = await pool.query(
      `SELECT id, invitee_id, status, session_code FROM session_invites WHERE id = $1`,
      [inviteId]
    );
    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: "Invite not found" });
    }

    const invite = inviteResult.rows[0] as {
      id: number;
      invitee_id: string;
      status: string;
      session_code: string;
    };

    if (invite.invitee_id !== userId) {
      return res.status(403).json({ error: "Not your invite" });
    }

    if (invite.status !== "pending") {
      return res.status(409).json({ error: "Invite already responded to" });
    }

    // If accepting, check session hasn't started
    if (action === "accept") {
      const sessionResult = await pool.query(
        `SELECT status FROM game_sessions WHERE session_code = $1`,
        [invite.session_code]
      );
      if (sessionResult.rows[0]?.status === "active") {
        return res.status(410).json({ error: "Session already started" });
      }
    }

    const newStatus = action === "accept" ? "accepted" : "declined";
    await pool.query(
      `UPDATE session_invites SET status = $1 WHERE id = $2`,
      [newStatus, inviteId]
    );

    return res.json({ id: inviteId, status: newStatus, sessionCode: invite.session_code });
  })
);

export default router;
