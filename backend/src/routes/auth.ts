import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import asyncHandler from "../middleware/asyncHandler";
import UserModel from "../models/User";

const router = Router();

// POST /api/auth/signup
router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: "Username, email, and password are required" });
      return;
    }

    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: "An account with that email or username already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userID = crypto.randomUUID();

    const newUser = new UserModel({
      userID,
      username,
      email,
      password: passwordHash,
    });

    await newUser.save();

    // Log user in automatically after signup
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

    req.session.userId = newUser.userID;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    res.status(201).json({
      userID: newUser.userID,
      username: newUser.username,
      email: newUser.email,
    });
  })
);

// POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ message: "email and password are required" });
      return;
    }

    const user = await UserModel.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

    req.session.userId = user.userID;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    res.status(200).json({
      userID: user.userID,
      username: user.username,
      email: user.email,
    });
  }),
);

// GET /api/auth/me
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    if (!req.session.userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const user = await UserModel.findById(req.session.userId);

    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      userID: user.userID,
      username: user.username,
      email: user.email,
      avatar: user.avatar ?? null,
    });
  }),
);

// POST /api/auth/logout
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });

    res.clearCookie("connect.sid");
    res.status(200).json({ message: "Logged out" });
  }),
);

export default router;
