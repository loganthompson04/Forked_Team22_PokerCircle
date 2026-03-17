import http from "http";
import { Server, Socket } from "socket.io";
import dotenv from "dotenv";
import app from "./app";
import { addPlayer, createSession, getSession, removePlayer } from "./store/sessionStore";
import type { JoinRoomPayload, LobbyUpdatePayload } from "./types/socketEvents";

dotenv.config();
console.log('DATABASE_URL exists:', Boolean(process.env['DATABASE_URL']));

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Wrap Express in an HTTP server
const httpServer = http.createServer(app);

// Attach Socket.IO (also set on app so route handlers can emit events)
const io = new Server(httpServer, {
  cors:
    process.env.NODE_ENV !== "production"
      ? { origin: "*", methods: ["GET", "POST"] }
      : { origin: false },
});

app.set('io', io);

io.on("connection", (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("session:joinRoom", ({ sessionCode, playerName }: JoinRoomPayload) => {
    let session = getSession(sessionCode);
    if (!session) {
      createSession({ sessionCode, players: [], createdAt: new Date().toISOString() });
      session = getSession(sessionCode)!;
    }
    if (!session) {
      socket.emit('error', { message: `Session ${sessionCode} not found` });
      return;
    }

    const code = session.sessionCode;

    const player = { playerId: socket.id, name: playerName, isReady: false };

    if (!session.players.some((p) => p.playerId === socket.id)) {
      addPlayer(code, player);
    }

    socket.join(code);

    const updated = getSession(code);
    const payload: LobbyUpdatePayload = {
      sessionCode: code,
      players: updated?.players ?? [],
    };
    io.to(code).emit("lobby:update", payload);

    console.log(`Joined room ${code}: ${playerName} (${socket.id})`);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    for (const room of socket.rooms) {
      if (room === socket.id) continue;
      removePlayer(room, socket.id);
      const session = getSession(room);
      const payload: LobbyUpdatePayload = {
        sessionCode: room,
        players: session?.players ?? [],
      };
      io.to(room).emit("lobby:update", payload);
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
