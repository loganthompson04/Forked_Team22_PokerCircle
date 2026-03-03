# Artifact: Logical Data Structure (PokerCircle)

## 1. Implemented Now (Sprint 4): Lobby State

These tables support creating a lobby, joining a lobby, and fetching lobby state (session + players).

### game_sessions (Lobby Rooms)
- `id`: SERIAL (PK)
- `sessionCode`: TEXT (UNIQUE, NOT NULL)
- `createdAt`: TIMESTAMPTZ (DEFAULT NOW(), NOT NULL)

Notes:
- This is the PokerCircle lobby/session concept (e.g., "ABC123").
- This is NOT the same as the `"session"` table used by express-session.

### players (Lobby Membership)
- `id`: SERIAL (PK)
- `sessionId`: INTEGER (FK → `game_sessions.id`, NOT NULL, ON DELETE CASCADE)
- `displayName`: TEXT (NOT NULL)
- `joinedAt`: TIMESTAMPTZ (DEFAULT NOW(), NOT NULL)

Constraints:
- `sessionId` must reference a valid lobby session.
- `displayName` cannot be null.
- `UNIQUE(sessionId, displayName)` prevents duplicate names in the same lobby.

---

## 2. Planned Later: Logical Data Structure (Simplified Poker Ledger)

This section is our long-term plan for tracking money/chips across games.

### Users (Accounts & Global Wallet)
- `user_id`: UUID (PK)
- `username`: VARCHAR(50)
- `total_balance`: BIGINT (Stored in cents/chips)
- `updated_at`: TIMESTAMPTZ

### Tables (Game Rooms)
- `table_id`: UUID (PK)
- `name`: VARCHAR(100)
- `min_buy_in`: BIGINT
- `max_buy_in`: BIGINT
- `is_active`: BOOLEAN

### Sessions (Player Table Presence)
- `session_id`: UUID (PK)
- `user_id`: UUID (FK)
- `table_id`: UUID (FK)
- `start_stack`: BIGINT (The initial buy-in)
- `end_stack`: BIGINT (The final amount when leaving)
- `status`: ENUM ('active', 'closed')
- `created_at`: TIMESTAMPTZ

### Transactions (The Audit Trail)
- `txn_id`: UUID (PK)
- `user_id`: UUID (FK)
- `session_id`: UUID (FK)
- `amount`: BIGINT (Negative for buy-ins, positive for payouts)
- `txn_type`: VARCHAR (e.g., 'INITIAL_BUY_IN', 'RE_BUY', 'SESSION_PAYOUT')
- `created_at`: TIMESTAMPTZ
