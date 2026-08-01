import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const jwtSecret = () => {
  if (env.jwtSecret) return env.jwtSecret;
  if (env.nodeEnv === "test") return "tv-digital-test-secret-not-for-production";

  const error = new Error("JWT_SECRET no está configurado");
  error.statusCode = 500;
  throw error;
};

export const hashPassword = (password) => bcrypt.hash(password, 12);

export const verifyPassword = (password, passwordHash) =>
  bcrypt.compare(password, passwordHash);

export const signAccessToken = (user) =>
  jwt.sign(
    { sub: String(user.id), rol: user.rol, email: user.email },
    jwtSecret(),
    { expiresIn: env.jwtExpiresIn }
  );

export const verifyAccessToken = (token) => jwt.verify(token, jwtSecret());
