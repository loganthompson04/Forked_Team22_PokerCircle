# Deployed Backend

**Railway URL:** https://team22pokercircle-production.up.railway.app

---

## REST Endpoints

* `GET /api/health` — health check
* `GET /ping` — ping
* `POST /api/auth/login` — login
* `POST /api/auth/signup` — signup
* `GET /api/auth/me` — current user
* `POST /api/sessions` — create session
* `GET /api/sessions/:code` — get session
* `POST /api/sessions/:code/join` — join session
* `POST /api/sessions/:code/ready` — toggle ready state

## Socket.IO Events

| Event | Direction | Description |
|---|---|---|
| `player-joined` | Server → Client | Broadcasts when a new player joins the lobby |
| `player-left` | Server → Client | Broadcasts when a player disconnects from the lobby |
| `player-ready` | Server → Client | Broadcasts when a player's ready state changes |
| `game-started` | Server → Client | Broadcasts to all clients when the host starts the game |

---

## Environment Variables

These must be set in the Railway dashboard. Nothing sensitive should be committed to the repo.

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase connection pooler URI (Session mode — must use pooler, not direct connection) |
| `SESSION_SECRET` | 64-byte random hex string |
| `NODE_ENV` | `production` |
| `WEB_ORIGIN` | Comma-separated list of allowed frontend origins (e.g. `http://localhost:8081`) |

> `PORT` is injected automatically by Railway — do not set it manually.

---

## Switching Between Local and Deployed

* **Frontend:** The backend URL is set in `frontend/src/config/api.ts`. Change `BACKEND_URL` to `http://localhost:3000` for local development or the Railway URL for deployed testing.
* **Backend:** Set `WEB_ORIGIN` to match whatever frontend origin is connecting. For local Expo, this is typically `http://localhost:8081`.

---

## Notes

* The backend must connect to Supabase via the **connection pooler** (`aws-0-us-east-1.pooler.supabase.com:5432`, Session mode). The direct connection hostname resolves to IPv6 which Railway cannot reach.
* Express is configured with `trust proxy` enabled, which is required for session cookies to work correctly behind Railway's HTTPS proxy.
