// Aegis Node — Fastify Server Entry Point
//
// Boots the core backend: HTTP API, Socket.io real-time,
// and MQTT telemetry ingestion.
//
// Architecture:
//   Fastify (HTTP) ← REST API routes
//         ↕
//   Socket.io      ← Real-time telemetry + alert broadcast
//         ↕
//   MQTT Subscriber ← ESP32 telemetry ingestion
//         ↕
//   PostgreSQL     ← Persistent storage (Drizzle ORM)

import Fastify from "fastify";
import cors from "@fastify/cors";
import { createServer } from "http";
import { env } from "./config/env.js";
import { initSocketServer } from "./socket/handler.js";
import { initMqttSubscriber } from "./mqtt/subscriber.js";
import { machineRoutes } from "./routes/machines.js";
import { telemetryRoutes } from "./routes/telemetry.js";
import { alertRoutes } from "./routes/alerts.js";
import { analyzeReading } from "./services/anomaly.js";


async function bootstrap() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "development" ? "info" : "warn",
      transport:
        env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            }
          : undefined,
    },
    // Use a raw HTTP server so Socket.io can share the same port
    serverFactory: (handler) => {
      const httpServer = createServer((req, res) => {
        handler(req, res);
      });
      return httpServer;
    },
  });

  await app.register(cors, {
    origin: true, // Allow all origins in dev; lock down in production
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });

  app.get("/health", async () => ({
    status: "operational",
    service: "aegis-backend",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  app.get("/api", async () => ({
    name: "Aegis Node API",
    version: "1.0.0",
    description:
      "Predictive machine maintenance — IoT telemetry ingestion and anomaly detection",
    endpoints: {
      health: "/health",
      machines: "/api/machines",
      telemetry: "/api/telemetry/:machineId",
      alerts: "/api/alerts",
    },
  }));

  await app.register(machineRoutes);
  await app.register(telemetryRoutes);
  await app.register(alertRoutes);

  // Socket.io shares the same HTTP server as Fastify,
  // so both REST and WebSocket traffic use port 3001.
  const httpServer = app.server;
  const io = initSocketServer(httpServer);

  // Wires the MQTT ingestion engine to the anomaly detection pipeline.
  // Every validated reading flows: MQTT → DB → Socket.io → Anomaly Engine
  const mqttService = initMqttSubscriber(io, (machineId, data) => {
    // Fire-and-forget: anomaly detection runs async without blocking ingestion
    analyzeReading(machineId, data.vibration_rms, data.temp_c, io).catch(
      (err) => console.error(`❌ [ANOMALY] Detection error:`, err)
    );
  });

  // Start the Predictive Trend continuous analyzer
  import("./services/scheduler.js").then(({ initScheduler }) => {
    initScheduler(io);
  });

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    console.log("\n══════════════════════════════════════════");
    console.log("  ⚡ AEGIS NODE — Backend Online");
    console.log(`  🌐 Server:   ${address}`);
    console.log(`  📡 MQTT:     ${env.MQTT_BROKER_URL}`);
    console.log(`  🧠 AI:       ${env.AI_SERVICE_URL}`);
    console.log(`  🗄️  Database: Connected`);
    console.log(`  🔌 Socket:   Ready (same port)`);
    console.log(`  🔧 Mode:     ${env.NODE_ENV}`);
    console.log("══════════════════════════════════════════\n");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // On SIGINT/SIGTERM, close all connections cleanly.
  // Essential for industrial systems — don't orphan connections.
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 [AEGIS] Received ${signal}, shutting down gracefully...`);
    await mqttService.shutdown();
    io.close();
    await app.close();
    console.log("🛑 [AEGIS] All services stopped. Goodbye.");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap();
