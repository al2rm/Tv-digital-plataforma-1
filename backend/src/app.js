import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import healthRoutes from "./routes/health.routes.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "API TV Digital Plataforma",
    version: "1.0.0"
  });
});

app.use("/api/health", healthRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
