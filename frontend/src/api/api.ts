import type { Session } from '../types/session';
import type { Friend, SessionInvite } from '../types/invite';
import { BACKEND_URL } from '../config/api';

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
