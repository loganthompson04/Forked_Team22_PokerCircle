# Sessions API

Base path: `/api/sessions`

All responses are JSON unless otherwise noted.

---

## Create Session

### POST `/api/sessions`

Creates a new session with a unique 6-character session code.

**Request Body**
- None

**Success Response**
- Status: `201 Created`
- Body:
```json
{
  "sessionCode": "34ZRHE",
  "createdAt": "2026-03-03T00:07:55.643Z",
  "players": []
}
```

**Error Response**
- Status: `500 Internal Server Error`
- Body:
```json
{
  "error": "Failed to generate unique session code"
}
```

---

## Get Session By Code

### GET `/api/sessions/:sessionCode`

Fetches an existing session by session code. Used by the Lobby screen to load current lobby state.

**Path Parameters**
- `sessionCode` (string): 6-character session code

**Success Response**
- Status: `200 OK`
- Body:
```json
{
  "sessionCode": "38V45J",
  "createdAt": "2026-03-03T00:06:56.722Z",
  "players": []
}
```

**Error Response**
- Status: `404 Not Found`
- Body:
```json
{
  "error": "Session not found"
}
```

---

## Route Health Check

### GET `/api/sessions`

Basic route reachability check.

**Success Response**
- Status: `200 OK`
- Body:
```json
{
  "status": "ok",
  "message": "sessions route reachable"
}
```