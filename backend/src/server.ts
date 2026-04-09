import http from 'http';
import { Server, Socket } from 'socket.io';
import dotenv from 'dotenv';
import app from './app';
import {
  addPlayer,
  createSession,
  getSession,
  removePlayer,
} from './store/sessionStore';
import type { SocketPlayer, SocketSession } from './store/sessionStore';
import type { JoinRoomPayload, LobbyUpdatePayload } from './types/socketEvents';

dotenv.config();
console.log('DATABASE_URL exists:', Boolean(process.env['DATABASE_URL']));

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const httpServer = http.createServer(app);

const rawOrigins = process.env['WEB_ORIGIN'] ?? 'http://localhost:8081';
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim());

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Socket.IO CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join a personal room for receiving direct events (e.g. invites)
  socket.on('user:joinRoom', (userId: string) => {
    socket.join(`user:${userId}`);
    console.log(`Socket ${socket.id} joined user room: user:${userId}`);
  });

  socket.on('session:joinRoom', ({ sessionCode, playerName, avatar }: JoinRoomPayload) => {
    let session = getSession(sessionCode);

    if (!session) {
      const newSession: SocketSession = {
        sessionCode,
        players: [],
        createdAt: new Date().toISOString(),
      };
      createSession(newSession);
      session = getSession(sessionCode)!;
    }

    if (!session) {
      socket.emit('error', { message: `Session ${sessionCode} not found` });
      return;
    }

    const code = session.sessionCode;

    const player: SocketPlayer = {
      playerId: socket.id,
      name: playerName,
      isReady: false,
      avatar: avatar ?? null,
    };

    if (!session.players.some((p) => p.playerId === socket.id)) {
      addPlayer(code, player);
    }

    socket.join(code);

    const updated = getSession(code);
    const payload: LobbyUpdatePayload = {
      sessionCode: code,
      players: updated?.players ?? [],
    };
    io.to(code).emit('lobby:update', payload);

    console.log(`Joined room ${code}: ${playerName} (${socket.id})`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    for (const room of socket.rooms) {
      if (room === socket.id) continue;
      removePlayer(room, socket.id);
      const session = getSession(room);
      const payload: LobbyUpdatePayload = {
        sessionCode: room,
        players: session?.players ?? [],
      };
      io.to(room).emit('lobby:update', payload);
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});