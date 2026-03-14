// Aegis Node — Environment Configuration
// Centralizes all env vars with fail-fast validation

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

interface EnvConfig {
  DATABASE_URL: string;
  MQTT_BROKER_URL: string;
  MQTT_TOPIC_PREFIX: string;
  AI_SERVICE_URL: string;
  PORT: number;
  HOST: string;
  NODE_ENV: string;
  JWT_SECRET: string;
}

function loadEnv(): EnvConfig {
  const required = ["DATABASE_URL"] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(
        `[AEGIS CONFIG] Missing required environment variable: ${key}. Copy .env.example to .env and fill in the values.`,
      );
    }
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
    MQTT_TOPIC_PREFIX: process.env.MQTT_TOPIC_PREFIX || "aegis/telemetry",
    AI_SERVICE_URL: process.env.AI_SERVICE_URL || "http://localhost:8000",
    PORT: parseInt(process.env.PORT || "3001", 10),
    HOST: process.env.HOST || "0.0.0.0",
    NODE_ENV: process.env.NODE_ENV || "development",
    JWT_SECRET:
      process.env.JWT_SECRET || "aegis-dev-secret-change-in-production",
  };
}

export const env = loadEnv();
