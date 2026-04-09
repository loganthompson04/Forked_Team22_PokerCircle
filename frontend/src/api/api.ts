import type { Session, Player } from '../types/session';
import type { Friend, FriendRequest, SessionInvite } from '../types/invite';
import type { UserStats, UserSession } from '../types/profile';
import { BACKEND_URL } from '../config/api';

export type SessionStatus = 'waiting' | 'starting' | 'active' | 'finished';
export type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';
export type UserSearchResult = {
  userId: string;
  username: string;
  friendshipStatus: FriendshipStatus;
  friendshipId: number | null;
};

export type PlayerResult = { displayName: string; netResult: number };
export type SettlementTransaction = { from: string; to: string; amount: number };
export type SettlementResults = {
  playerResults: PlayerResult[];
  transactions: SettlementTransaction[];
};

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function getSession(sessionCode: string): Promise<Session> {
  const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionCode}`, {
    credentials: 'include',
  });
  if (response.status === 404) {
    throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  }
  if (!response.ok) {
    throw new Error('Failed to fetch session');
  }
  return response.json() as Promise<Session>;
}

export async function createSession(): Promise<Session> {
  const response = await fetch(`${BACKEND_URL}/api/sessions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Failed to create session');
  }
  return response.json() as Promise<Session>;
}

export async function startSession(sessionCode: string): Promise<Session> {
  const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionCode}/start`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Failed to start session');
  }
  return response.json() as Promise<Session>;
}

// ---------------------------------------------------------------------------
// TM22-87: Financial data
// ---------------------------------------------------------------------------

/**
 * Update a player's buy-in, rebuy total, and/or cash-out.
 * All fields are optional — only supplied fields are updated.
 */
export async function updatePlayerFinances(
  sessionCode: string,
  displayName: string,
  finances: { buyIn?: number; rebuyTotal?: number; cashOut?: number }
): Promise<void> {
  const response = await fetch(
    `${BACKEND_URL}/api/sessions/${sessionCode}/players/${encodeURIComponent(displayName)}/finances`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finances),
    }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Failed to update finances');
  }
}

// ---------------------------------------------------------------------------
// TM22-87/88: Session completion + results
// ---------------------------------------------------------------------------

/**
 * Host-only: mark the session finished and broadcast game:complete to all clients.
 */
export async function completeSession(sessionCode: string): Promise<Session> {
  const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionCode}/complete`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Failed to complete session');
  }
  return response.json() as Promise<Session>;
}

export async function getSessionPlayers(sessionCode: string): Promise<Player[]> {
  const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionCode}/players`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Failed to fetch players');
  }
  return response.json() as Promise<Player[]>;
}

/**
 * Fetch net results and minimum-transaction settlement plan for a session.
 */
export async function getSessionResults(sessionCode: string): Promise<SettlementResults> {
  const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionCode}/results`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Failed to fetch results');
  }
  return response.json() as Promise<SettlementResults>;
}

// ---------------------------------------------------------------------------
// Session status
// ---------------------------------------------------------------------------

export async function updateSessionStatus(
  sessionCode: string,
  status: SessionStatus
): Promise<Session> {
  const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionCode}/status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Failed to update session status');
  }
  return response.json() as Promise<Session>;
}

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------

export async function getFriends(): Promise<Friend[]> {
  const response = await fetch(`${BACKEND_URL}/api/friends`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Failed to fetch friends');
  }
  const data = await response.json() as { friends: Friend[] };
  return data.friends;
}

export async function sendInvite(sessionCode: string, inviteeId: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionCode}/invite`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteeId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Failed to send invite');
  }
}

export async function getPendingInvites(): Promise<SessionInvite[]> {
  const response = await fetch(`${BACKEND_URL}/api/invites/pending`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Failed to fetch invites');
  }
  const data = await response.json() as { invites: SessionInvite[] };
  return data.invites;
}

export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  const response = await fetch(
    `${BACKEND_URL}/api/friends/search?q=${encodeURIComponent(q)}`,
    { credentials: 'include' }
  );
  if (!response.ok) throw new Error('Search failed');
  const data = await response.json() as { users: UserSearchResult[] };
  return data.users;
}

export async function sendFriendRequest(addresseeId: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/friends/request`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addresseeId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Failed to send friend request');
  }
}

export async function getPendingFriendRequests(): Promise<FriendRequest[]> {
  const response = await fetch(`${BACKEND_URL}/api/friends/requests`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch friend requests');
  const data = await response.json() as { requests: FriendRequest[] };
  return data.requests;
}

export async function respondToFriendRequest(
  id: number,
  action: 'accept' | 'decline'
): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/friends/requests/${id}/respond`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Failed to respond to friend request');
  }
}

export async function respondToInvite(
  id: number,
  action: 'accept' | 'decline'
): Promise<{ id: number; status: string; sessionCode: string }> {
  const response = await fetch(`${BACKEND_URL}/api/invites/${id}/respond`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw Object.assign(new Error(body.error ?? 'Failed to respond to invite'), {
      statusCode: response.status,
    });
  }
  return response.json() as Promise<{ id: number; status: string; sessionCode: string }>;
}

export async function declineInvite(id: number): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/invites/${id}/decline`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Failed to decline invite');
  }
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getUserStats(userId: number): Promise<UserStats> {
  const response = await fetch(`${BACKEND_URL}/api/users/${userId}/stats`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw Object.assign(new Error(body.error ?? 'Failed to fetch user stats'), {
      statusCode: response.status,
    });
  }
  const data = await response.json() as { stats: UserStats };
  return data.stats;
}

export async function getUserSessions(userId: number): Promise<UserSession[]> {
  const response = await fetch(`${BACKEND_URL}/api/users/${userId}/sessions`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw Object.assign(new Error(body.error ?? 'Failed to fetch user sessions'), {
      statusCode: response.status,
    });
  }
  const data = await response.json() as { sessions: UserSession[] };
  return data.sessions;
}

export async function updateDisplayName(userId: number, newName: string): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/api/users/${userId}/displayname`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newName }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw Object.assign(new Error(body.error ?? 'Failed to update display name'), {
      statusCode: response.status,
    });
  }
  const data = await response.json() as { username: string };
  return data.username;
}

export async function updateAvatar(userId: number, avatarId: string): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/api/users/${userId}/avatar`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw Object.assign(new Error(body.error ?? 'Failed to update avatar'), {
      statusCode: response.status,
    });
  }
  const data = await response.json() as { avatar: string };
  return data.avatar;
}