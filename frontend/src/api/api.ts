import type { Session } from '../types/session';

const BASE_URL = 'http://localhost:3000';

export async function getSession(sessionCode: string): Promise<Session> {
  const response = await fetch(`${BASE_URL}/api/sessions/${sessionCode}`, {
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
  const response = await fetch(`${BASE_URL}/api/sessions`, {
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
