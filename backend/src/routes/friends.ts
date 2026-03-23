import { Router } from "express";
import type { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import pool from "../db/pool";
import type { Friend, FriendRequest } from "../types/invite";

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

router.get('/search', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const q = typeof req.query['q'] === 'string' ? req.query['q'].trim() : '';
  if (!q) return res.json({ users: [] });

  const result = await pool.query<{ userId: string; username: string; friendshipStatus: string; friendshipId: number | null }>(
    `SELECT
       u.user_id AS "userId",
       u.username,
       f.id AS "friendshipId",
       CASE
         WHEN f.id IS NULL THEN 'none'
         WHEN f.requester_id = $2 THEN 'pending_sent'
         WHEN f.addressee_id = $2 AND f.status = 'pending' THEN 'pending_received'
         ELSE 'accepted'
       END AS "friendshipStatus"
     FROM users u
     LEFT JOIN friendships f ON (
       (f.requester_id = $2 AND f.addressee_id = u.user_id) OR
       (f.addressee_id = $2 AND f.requester_id = u.user_id)
     ) AND f.status IN ('pending', 'accepted')
     WHERE u.username ILIKE $1 AND u.user_id != $2
     LIMIT 20`,
    [`%${q}%`, userId]
  );
  return res.json({ users: result.rows });
}));

router.post('/request', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const requesterId = req.session.userId!;
  const { addresseeId } = req.body as { addresseeId: string };

  const userCheck = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [addresseeId]);
  if (userCheck.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
  if (addresseeId === requesterId) return res.status(400).json({ error: 'Cannot add yourself.' });

  const result = await pool.query(
    `INSERT INTO friendships (requester_id, addressee_id, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT ON CONSTRAINT unique_friendship
       DO UPDATE SET status = 'pending', created_at = NOW()
       WHERE friendships.status = 'declined'
     RETURNING id`,
    [requesterId, addresseeId]
  );
  if (result.rows.length === 0) return res.status(409).json({ error: 'Friend request already sent.' });
  return res.status(201).json({ id: result.rows[0].id });
}));

router.get('/requests', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const result = await pool.query<FriendRequest>(
    `SELECT f.id, f.requester_id AS "requesterId", u.username AS "requesterUsername", f.created_at AS "createdAt"
     FROM friendships f
     JOIN users u ON u.user_id = f.requester_id
     WHERE f.addressee_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return res.json({ requests: result.rows });
}));

router.post('/requests/:id/respond', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const paramId = req.params['id'];
  const id = parseInt(typeof paramId === 'string' ? paramId : '', 10);
  const { action } = req.body as { action: 'accept' | 'decline' };
  if (action !== 'accept' && action !== 'decline') return res.status(400).json({ error: 'Invalid action.' });

  const status = action === 'accept' ? 'accepted' : 'declined';
  const result = await pool.query(
    `UPDATE friendships SET status = $1
     WHERE id = $2 AND addressee_id = $3 AND status = 'pending'
     RETURNING id`,
    [status, id, userId]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Request not found.' });
  return res.json({ id, status });
}));

export default router;
