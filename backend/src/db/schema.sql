CREATE TABLE IF NOT EXISTS users (
  "userID"   TEXT  PRIMARY KEY,
  username   TEXT  NOT NULL UNIQUE,
  email      TEXT  NOT NULL UNIQUE,
  password   TEXT  NOT NULL
);

-- Ensure username uniqueness constraint exists on pre-existing databases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_username_key'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;
END $$;

-- Express-session store table (connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid"    varchar        NOT NULL COLLATE "default",
  "sess"   json           NOT NULL,
  "expire" timestamp(6)   NOT NULL
)
WITH (OIDS=FALSE);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_pkey'
      AND conrelid = 'session'::regclass
  ) THEN
    ALTER TABLE "session"
      ADD CONSTRAINT "session_pkey"
      PRIMARY KEY ("sid") DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Game sessions (do NOT confuse with express-session table named "session")
CREATE TABLE IF NOT EXISTS game_sessions (
  session_code  VARCHAR(6)  PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  host_user_id  TEXT        NOT NULL REFERENCES users("userID"),
  status        VARCHAR(20) NOT NULL DEFAULT 'waiting',
  buy_in_amount INTEGER     NOT NULL DEFAULT 0,
  max_rebuys    INTEGER     NOT NULL DEFAULT 0,
  game_state    JSONB       NOT NULL DEFAULT '{}'
);

-- Players in a game session (persisted lobby membership)
CREATE TABLE IF NOT EXISTS session_players (
  id           SERIAL      PRIMARY KEY,
  session_code VARCHAR(6)  NOT NULL REFERENCES game_sessions(session_code) ON DELETE CASCADE,
  display_name TEXT        NOT NULL,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_ready     BOOLEAN     NOT NULL DEFAULT FALSE,
  buy_in       INTEGER     NOT NULL DEFAULT 0,
  rebuy_total  INTEGER     NOT NULL DEFAULT 0,
  cash_out     INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_session_players_session_code
  ON session_players(session_code);

-- Friendships
CREATE TABLE IF NOT EXISTS friendships (
  id           SERIAL      PRIMARY KEY,
  requester_id TEXT        NOT NULL REFERENCES users("userID") ON DELETE CASCADE,
  addressee_id TEXT        NOT NULL REFERENCES users("userID") ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_friendship UNIQUE (requester_id, addressee_id)
);

-- Session invites
CREATE TABLE IF NOT EXISTS session_invites (
  id           SERIAL      PRIMARY KEY,
  session_code VARCHAR(6)  NOT NULL REFERENCES game_sessions(session_code) ON DELETE CASCADE,
  inviter_id   TEXT        NOT NULL REFERENCES users("userID") ON DELETE CASCADE,
  invitee_id   TEXT        NOT NULL REFERENCES users("userID") ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_invite UNIQUE (session_code, invitee_id)
);

-- Safe migrations for pre-existing databases
ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS status        VARCHAR(20) NOT NULL DEFAULT 'waiting',
  ADD COLUMN IF NOT EXISTS buy_in_amount INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_rebuys    INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS game_state    JSONB       NOT NULL DEFAULT '{}';

ALTER TABLE session_players
  ADD COLUMN IF NOT EXISTS buy_in      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rebuy_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_out    INTEGER NOT NULL DEFAULT 0;