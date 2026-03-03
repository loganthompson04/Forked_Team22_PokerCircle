import "dotenv/config";
import pool from "../db/pool";

const initDb = async () => {
  const client = await pool.connect();

  try {
    console.log("Creating tables...");

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        total_balance BIGINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Lobby sessions (NOT express-session "session" table)
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id SERIAL PRIMARY KEY,
        sessionCode TEXT NOT NULL UNIQUE,
        createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Players in a lobby
    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        sessionId INTEGER NOT NULL,
        displayName TEXT NOT NULL,
        joinedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT fk_players_session
          FOREIGN KEY (sessionId)
          REFERENCES game_sessions(id)
          ON DELETE CASCADE,

        CONSTRAINT unique_player_name_per_session UNIQUE (sessionId, displayName)
      );
    `);

    console.log("Tables created successfully.");
  } catch (error) {
    console.error("Error creating tables:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end(); // optional but helps scripts exit cleanly
  }
};

initDb();