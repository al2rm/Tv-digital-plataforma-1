import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  automation: {
    workerEnabled: process.env.AUTOMATION_WORKER_ENABLED === "true",
    intervalMs: Number(process.env.AUTOMATION_WORKER_INTERVAL_MS || 60000),
    batchSize: Number(process.env.AUTOMATION_WORKER_BATCH_SIZE || 20)
  },
  whatsapp: {
    mode: process.env.WHATSAPP_MODE || "assisted",
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
    appSecret: process.env.WHATSAPP_APP_SECRET || "",
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "595"
  },
  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || "tv_digital",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres"
  }
};
