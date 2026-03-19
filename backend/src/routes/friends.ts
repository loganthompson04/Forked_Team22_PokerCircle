import { Router } from "express";
import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import pool from "../db/pool";
import type { Friend } from "../types/invite";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.session.userId!;

    const result = await pool.query<Friend>(
      `
      SELECT
        CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END AS "userId",
        u.username
      FROM friendships f
      JOIN users u ON u.user_id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
      WHERE (f.requester_id = $1 OR f.addressee_id = $1)
        AND f.status = 'accepted'
      ORDER BY u.username ASC
      `,
      [userId]
    );

    return res.json({ friends: result.rows });
  })
);

export default router;
