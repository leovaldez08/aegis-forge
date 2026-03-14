// Telemetry API Routes
// GET /api/telemetry/:machineId          → Latest readings
// GET /api/telemetry/:machineId/history  → Time-range query

import { FastifyInstance } from "fastify";
import {
  getLatestReadings,
  getReadingsInRange,
} from "../services/telemetry.js";

export async function telemetryRoutes(app: FastifyInstance) {
  // Latest readings for a machine (default: last 50)
  app.get<{ Params: { machineId: string }; Querystring: { limit?: string } }>(
    "/api/telemetry/:machineId",
    async (req) => {
      const limit = parseInt(req.query.limit || "50", 10);
      const readings = await getLatestReadings(req.params.machineId, limit);
      return { readings };
    },
  );

  // Historical readings within a time range
  app.get<{
    Params: { machineId: string };
    Querystring: { since?: string; limit?: string };
  }>("/api/telemetry/:machineId/history", async (req) => {
    const since = req.query.since
      ? new Date(req.query.since)
      : new Date(Date.now() - 60 * 60 * 1000); // Default: last 1 hour
    const limit = parseInt(req.query.limit || "500", 10);
    const readings = await getReadingsInRange(
      req.params.machineId,
      since,
      limit,
    );
    return { readings };
  });
}
