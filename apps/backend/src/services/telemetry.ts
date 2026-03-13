// Telemetry Service — Query Layer
//
// Provides functions to read telemetry data from the
// database for REST API endpoints and anomaly detection.

import { db } from "../db/connection.js";
import { telemetry, machines } from "../db/schema.js";
import { desc, eq, and, gte } from "drizzle-orm";


export async function getLatestReadings(machineId: string, limit = 50) {
  return db
    .select()
    .from(telemetry)
    .where(eq(telemetry.machineId, machineId))
    .orderBy(desc(telemetry.timestamp))
    .limit(limit);
}


export async function getReadingsInRange(
  machineId: string,
  since: Date,
  limit = 500
) {
  return db
    .select()
    .from(telemetry)
    .where(
      and(
        eq(telemetry.machineId, machineId),
        gte(telemetry.timestamp, since)
      )
    )
    .orderBy(desc(telemetry.timestamp))
    .limit(limit);
}


export async function getAllMachines() {
  return db.select().from(machines);
}


export async function updateMachineStatus(
  machineId: string,
  status: "healthy" | "warning" | "critical"
) {
  return db
    .update(machines)
    .set({ status })
    .where(eq(machines.id, machineId));
}
