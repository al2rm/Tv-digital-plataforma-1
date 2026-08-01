import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import adminV2Routes from "./routes/adminV2.routes.js";
import crmRoutes from "./routes/crm.routes.js";
import healthRoutes from "./routes/health.routes.js";
import whatsappRoutes from "./routes/whatsapp.routes.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const adminDistPath = env.adminDistPath
  ? path.resolve(env.adminDistPath)
  : path.resolve(currentDir, "../../admin/dist");
const adminIndexPath = path.join(adminDistPath, "index.html");

if (env.serveAdmin && !fs.existsSync(adminIndexPath)) {
  throw new Error(
    `SERVE_ADMIN está habilitado, pero no existe ${adminIndexPath}. Compila el panel primero.`
  );
}

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes("*") || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origen no permitido por CORS"));
  }
}));
app.use(express.json({
  limit: "1mb",
  verify(req, res, buffer) {
    if (req.originalUrl.startsWith("/api/whatsapp/webhook")) {
      req.rawBody = buffer;
    }
  }
}));
app.use(morgan("dev"));

if (!env.serveAdmin) {
  app.get("/", (req, res) => {
    res.json({
      ok: true,
      message: "API TV Digital Plataforma",
      version: "1.0.0"
    });
  });
}

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin/v2", adminV2Routes);
app.use("/api/crm", crmRoutes);
app.use("/api/whatsapp", whatsappRoutes);

if (env.serveAdmin) {
  app.use(express.static(adminDistPath));
  app.get("*", (req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      return next();
    }
    return res.sendFile(adminIndexPath);
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
