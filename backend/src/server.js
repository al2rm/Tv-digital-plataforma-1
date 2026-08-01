import dotenv from "dotenv";
import app from "./app.js";
import { env } from "./config/env.js";
import {
  startAutomationWorker,
  stopAutomationWorker
} from "./services/automation.service.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Servidor TV Digital ejecutándose en puerto ${PORT}`);
  if (env.automation.workerEnabled) {
    startAutomationWorker();
    console.log("Trabajador de automatización habilitado");
  }
});

const shutdown = (signal) => {
  console.log(`${signal}: cerrando servidor`);
  stopAutomationWorker();
  server.close(() => process.exit(0));
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
