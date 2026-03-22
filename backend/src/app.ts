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
app.set("trust proxy", 1); // Required on Railway — tells Express to trust the HTTPS proxy
const PgStore = connectPgSimple(session);

app.use(express.json());
// ─── CORS ─────────────────────────────────────────────────────────────────────
// WEB_ORIGIN is a comma-separated list of allowed frontend origins.
// Set it in Railway dashboard. Example value:
//   http://localhost:8081,https://your-expo-app.up.railway.app
//
// Native mobile apps (iOS/Android) send no Origin header, so we must
// allow requests with no origin — otherwise the app breaks on device.
const rawOrigins = process.env["WEB_ORIGIN"] ?? "http://localhost:8081";
const allowedOrigins = rawOrigins.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // No origin = native mobile app, curl, Postman — always allow
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

// ─── Request logging ─────────────────────────────────────────────────────────
app.use(
  morgan(":method :url :status :response-time ms", {
    skip: () => process.env["NODE_ENV"] === "test",
  })
);

// ─── Sessions ─────────────────────────────────────────────────────────────────
// When deployed to Railway (HTTPS), cookies must be:
//   secure: true  — only sent over HTTPS
//   sameSite: "none" — required for cross-origin requests (mobile app → Railway API)
//
// In local dev (HTTP), those settings break cookies, so we flip them.
const isProduction = process.env["NODE_ENV"] === "production";

const sessionConfig: session.SessionOptions = {
  secret: process.env["SESSION_SECRET"] ?? "dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: isProduction ? "none" : "lax",
  },
};

if (process.env["NODE_ENV"] !== "test") {
  sessionConfig.store = new PgStore({
    pool,
    tableName: "session",
    createTableIfMissing: true,
  });
}

app.use(session(sessionConfig));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/sessions", sessionsRouter);

app.get("/ping", (_req, res) => {
  res.json({ message: "pong" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Debug routes only available in non-production
if (!isProduction) {
  app.use("/api/debug", debugRouter);
}

// 404 + error handlers must come after all routes
app.use(notFound);
app.use(errorHandler);

export default app;
