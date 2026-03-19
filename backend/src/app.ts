import express from "express";
import sessionsRouter from "./routes/sessions";
import { notFound, errorHandler } from "./middleware/errorMiddleware";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import morgan from "morgan";

import pool from "./db/pool";
import debugRouter from "./routes/debug";
import authRouter from "./routes/auth";

const app = express();
const PgStore = connectPgSimple(session);

app.use(express.json());
// DEV CORS: allow requests from Expo Web during local testing
if (process.env.NODE_ENV !== "production") {
  app.use(
    cors({
      origin: process.env.WEB_ORIGIN ?? 'http://localhost:8081',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );
} else {
  // production: lock down later (e.g., real frontend origin)
  app.use(cors({ origin: false }));
}
// Request logging (no headers/secrets by default)
app.use(
  morgan(":method :url :status :response-time ms", {
    skip: () => process.env.NODE_ENV === "test",
  })
);

const sessionConfig: session.SessionOptions = {
  secret: process.env["SESSION_SECRET"] ?? "dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
  },
};

if (process.env["NODE_ENV"] !== "test") {
  sessionConfig.store = new PgStore({ pool, tableName: "session", createTableIfMissing: false });
}

app.use(session(sessionConfig));

// routes
app.use("/api/auth", authRouter);
app.use("/api/sessions", sessionsRouter);

app.get("/ping", (req, res) => {
  res.json({ message: "pong" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// dev-only debug
if (process.env.NODE_ENV !== "production") {
  app.use("/api/debug", debugRouter);
}

// 404 + error middleware MUST be after all routes
app.use(notFound);
app.use(errorHandler);

export default app;
