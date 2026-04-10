import "dotenv/config";
import pool from "../db/pool";

// ---------------------------------------------------------------------------
// Sample sessions — varied wins, losses, player counts, and dates
// net = cash_out - buy_in - rebuy_total
// ---------------------------------------------------------------------------

interface SampleSession {
  sessionCode: string;
  daysAgo: number;
  players: { username: string; buyIn: number; rebuyTotal: number; cashOut: number }[];
}

const SESSIONS: SampleSession[] = [
  {
    sessionCode: "ALPHA1",
    daysAgo: 1,
    players: [
      { username: "DemoPlayer1", buyIn: 100, rebuyTotal: 0,  cashOut: 175 }, // +75
      { username: "DemoPlayer2", buyIn: 100, rebuyTotal: 50, cashOut: 75  }, // -75
    ],
  },
  {
    sessionCode: "BRAVO2",
    daysAgo: 5,
    players: [
      { username: "DemoPlayer1", buyIn: 100, rebuyTotal: 0,  cashOut: 60  }, // -40
      { username: "DemoPlayer2", buyIn: 100, rebuyTotal: 0,  cashOut: 140 }, // +40
    ],
  },
  {
    sessionCode: "CHARL3",
    daysAgo: 12,
    players: [
      { username: "DemoPlayer1", buyIn: 100, rebuyTotal: 100, cashOut: 280 }, // +80
      { username: "DemoPlayer2", buyIn: 100, rebuyTotal: 0,   cashOut: 50  }, // -50
      { username: "GuestPlayer", buyIn: 100, rebuyTotal: 0,   cashOut: 70  }, // -30
    ],
  },
  {
    sessionCode: "DELTA4",
    daysAgo: 20,
    players: [
      { username: "DemoPlayer1", buyIn: 100, rebuyTotal: 0,  cashOut: 50  }, // -50
      { username: "DemoPlayer2", buyIn: 100, rebuyTotal: 0,  cashOut: 130 }, // +30
      { username: "GuestPlayer", buyIn: 100, rebuyTotal: 0,  cashOut: 120 }, // +20
    ],
  },
  {
    sessionCode: "ECHO55",
    daysAgo: 35,
    players: [
      { username: "DemoPlayer1", buyIn: 100, rebuyTotal: 0,  cashOut: 220 }, // +120
      { username: "DemoPlayer2", buyIn: 100, rebuyTotal: 50, cashOut: 30  }, // -120
    ],
  },
  {
    sessionCode: "FOXT6",
    daysAgo: 45,
    players: [
      { username: "DemoPlayer1", buyIn: 100, rebuyTotal: 0,  cashOut: 85  }, // -15
      { username: "DemoPlayer2", buyIn: 100, rebuyTotal: 0,  cashOut: 115 }, // +15
      { username: "GuestPlayer", buyIn: 100, rebuyTotal: 0,  cashOut: 100 }, // 0 (break even)
    ],
  },
];

async function seedSampleSessions() {
  const client = await pool.connect();

  try {
    console.log("Looking up user IDs...");

    // Fetch all real users (those that exist in the DB)
    const usersRes = await client.query<{ user_id: string; username: string }>(
      `SELECT user_id, username FROM users ORDER BY username`
    );
    const userMap = new Map(usersRes.rows.map((r) => [r.username, r.user_id]));
    console.log(`  Found users: ${[...userMap.keys()].join(", ")}`);

    // We need at least one real user to act as host
    const hostUserId = userMap.get("DemoPlayer1") ?? [...userMap.values()][0];
    if (!hostUserId) {
      throw new Error("No users found in DB. Run seed-demo-users first.");
    }

    console.log("\nInserting sample sessions...");

    for (const session of SESSIONS) {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - session.daysAgo);

      // Insert game session (skip if already exists)
      await client.query(
        `INSERT INTO game_sessions (session_code, host_user_id, status, created_at)
         VALUES ($1, $2, 'finished', $3)
         ON CONFLICT (session_code) DO NOTHING`,
        [session.sessionCode, hostUserId, createdAt.toISOString()]
      );

      for (const p of session.players) {
        // Insert player (skip if already exists)
        await client.query(
          `INSERT INTO session_players (session_code, display_name, is_ready, buy_in, rebuy_total, cash_out)
           VALUES ($1, $2, true, $3, $4, $5)
           ON CONFLICT (session_code, display_name) DO NOTHING`,
          [session.sessionCode, p.username, p.buyIn, p.rebuyTotal, p.cashOut]
        );
      }

      const playerSummary = session.players
        .map((p) => {
          const net = p.cashOut - p.buyIn - p.rebuyTotal;
          return `${p.username}(${net >= 0 ? "+" : ""}${net})`;
        })
        .join(", ");

      console.log(`  ✓ ${session.sessionCode}  ${playerSummary}`);
    }

    console.log("\nSample sessions seeded successfully.");
  } catch (error) {
    console.error("Error seeding sample sessions:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedSampleSessions();