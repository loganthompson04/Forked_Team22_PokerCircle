import io from 'socket.io-client';

const BACKEND_URL = 'http://localhost:3000';

export const socket = io(BACKEND_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
});

socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('disconnect', (reason: any) => {
  console.log('Socket disconnected:', reason);
});

socket.on('reconnect', (attempt: any) => {
  console.log('Socket reconnected after attempt:', attempt);
});

socket.on('connect_error', (err: any) => {
  console.log('Socket connection error:', err.message);
});