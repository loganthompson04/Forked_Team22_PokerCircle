import { Router, Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import pool from "../db/pool";
import { generateSessionCode } from "../utils/sessionCode";


const router = Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", message: "sessions route reachable" });
});

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    let attempts = 0;

    while (attempts < 20) {
      const sessionCode = generateSessionCode(6);

      try {
        const result = await pool.query(
          `
          INSERT INTO game_sessions (sessioncode)
          VALUES ($1)
          RETURNING id, sessioncode, createdat;
          `,
          [sessionCode]
        );

        const row = result.rows[0];

        return res.status(201).json({
          sessionId: row.id,
          sessionCode: row.sessioncode,
          createdAt: row.createdat,
          players: [],
        });
      } catch (err: any) {
        if (err?.code === "23505") {
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
    const sessionCode = req.params.sessionCode;

    const result = await pool.query(
      `
      SELECT
        gs.id          AS "sessionId",
        gs.sessioncode AS "sessionCode",
        gs.createdat   AS "createdAt",
        p.id           AS "playerId",
        p.displayname  AS "displayName",
        p.joinedat     AS "joinedAt"
      FROM game_sessions gs
      LEFT JOIN players p
        ON p.sessionid = gs.id
      WHERE gs.sessioncode = $1
      ORDER BY p.joinedat ASC NULLS LAST;
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
        playerId: r.playerId,
        displayName: r.displayName,
        joinedAt: r.joinedAt,
      }));

    return res.status(200).json({
      sessionId: first.sessionId,
      sessionCode: first.sessionCode,
      createdAt: first.createdAt,
      players,
    });
  })
);

router.post(
  "/:sessionCode/join",
  asyncHandler(async (req: Request, res: Response) => {
    const sessionCode = req.params.sessionCode;
    const { displayName } = req.body as { displayName?: string };

    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: "displayName is required" });
    }

    // Find session
    const sessionResult = await pool.query(
      `SELECT id, sessioncode, createdat FROM game_sessions WHERE sessioncode = $1`,
      [sessionCode]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const sessionId = sessionResult.rows[0].id;

    try {
      await pool.query(
        `INSERT INTO players (sessionid, displayname) VALUES ($1, $2)`,
        [sessionId, displayName.trim()]
      );
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(409).json({ error: "Player name already exists in this session" });
      }
      throw err;
    }

    // Return updated state
    const stateResult = await pool.query(
      `
      SELECT
        gs.id          AS "sessionId",
        gs.sessioncode AS "sessionCode",
        gs.createdat   AS "createdAt",
        p.id           AS "playerId",
        p.displayname  AS "displayName",
        p.joinedat     AS "joinedAt"
      FROM game_sessions gs
      LEFT JOIN players p
        ON p.sessionid = gs.id
      WHERE gs.sessioncode = $1
      ORDER BY p.joinedat ASC NULLS LAST;
      `,
      [sessionCode]
    );

    const first = stateResult.rows[0];

    const players = stateResult.rows
      .filter((r) => r.playerId !== null)
      .map((r) => ({
        playerId: r.playerId,
        displayName: r.displayName,
        joinedAt: r.joinedAt,
      }));

    return res.status(200).json({
      sessionId: first.sessionId,
      sessionCode: first.sessionCode,
      createdAt: first.createdAt,
      players,
    });
  })
);

export default router;
