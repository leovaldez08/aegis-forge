// Alerts API Routes
// GET /api/alerts           → All maintenance logs
// GET /api/alerts/recent    → Last 20 alerts
// PATCH /api/alerts/:id     → Update alert status

import { FastifyInstance } from "fastify";
import { db } from "../db/connection.js";
import { maintenanceLogs, machines, workers } from "../db/schema.js";
import { desc, eq } from "drizzle-orm";

export async function alertRoutes(app: FastifyInstance) {
  // Recent alerts with machine + worker info
  app.get<{ Querystring: { limit?: string } }>("/api/alerts", async (req) => {
    const limit = parseInt(req.query.limit || "20", 10);
    const alerts = await db
      .select({
        id: maintenanceLogs.id,
        machineId: maintenanceLogs.machineId,
        machineName: machines.name,
        machineType: machines.type,
        workerId: maintenanceLogs.workerId,
        workerName: workers.name,
        severity: maintenanceLogs.severity,
        anomalyData: maintenanceLogs.anomalyData,
        agentMessage: maintenanceLogs.agentMessage,
        status: maintenanceLogs.status,
        createdAt: maintenanceLogs.createdAt,
      })
      .from(maintenanceLogs)
      .leftJoin(machines, eq(maintenanceLogs.machineId, machines.id))
      .leftJoin(workers, eq(maintenanceLogs.workerId, workers.id))
      .orderBy(desc(maintenanceLogs.createdAt))
      .limit(limit);

    return { alerts };
  });

  // Update alert status (acknowledge / resolve)
  app.patch<{
    Params: { id: string };
    Body: { status: "acknowledged" | "resolved" | "false_alarm" };
  }>("/api/alerts/:id", async (req, reply) => {
    const { status } = req.body;
    if (!["acknowledged", "resolved", "false_alarm"].includes(status)) {
      return reply.status(400).send({ error: "Invalid status" });
    }

    const updated = await db
      .update(maintenanceLogs)
      .set({ status })
      .where(eq(maintenanceLogs.id, req.params.id))
      .returning();

    if (updated.length === 0) {
      return reply.status(404).send({ error: "Alert not found" });
    }
    return { alert: updated[0] };
  });
}
