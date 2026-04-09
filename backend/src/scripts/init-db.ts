import "dotenv/config";
import pool from "../db/pool";

const initDb = async () => {
  const client = await pool.connect();

  try {
    console.log("Dropping existing tables...");

    await client.query(`
      DROP TABLE IF EXISTS session_players CASCADE;
      DROP TABLE IF EXISTS game_sessions CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS session CASCADE;
    `);

    console.log("Creating tables...");

    // Session store (connect-pg-simple)
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid     VARCHAR NOT NULL COLLATE "default",
        sess    JSON    NOT NULL,
        expire  TIMESTAMP(6) NOT NULL,
        CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE);
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
    `);

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        total_balance BIGINT DEFAULT 0,
        avatar TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Game sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        session_code TEXT PRIMARY KEY,
        host_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'waiting',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Players in a session
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_players (
        id SERIAL PRIMARY KEY,
        session_code TEXT NOT NULL REFERENCES game_sessions(session_code) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        is_ready BOOLEAN NOT NULL DEFAULT FALSE,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_player_per_session UNIQUE (session_code, display_name)
      );
    `);

    // Friendships (minimal — needed for invite authorization)
    await client.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id           SERIAL PRIMARY KEY,
        requester_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        addressee_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        status       TEXT NOT NULL DEFAULT 'pending',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_friendship UNIQUE (requester_id, addressee_id)
      );
    `);

    // Session invites
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_invites (
        id           SERIAL PRIMARY KEY,
        session_code TEXT NOT NULL REFERENCES game_sessions(session_code) ON DELETE CASCADE,
        inviter_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        invitee_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        status       TEXT NOT NULL DEFAULT 'pending',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_invite UNIQUE (session_code, invitee_id)
      );
    `);

    console.log("Tables created successfully.");
  } catch (error) {
    console.error("Error creating tables:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

initDb();
