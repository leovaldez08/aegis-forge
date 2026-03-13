import { db } from "../db/connection.js";
import { maintenanceLogs } from "../db/schema.js";
import { env } from "../config/env.js";
import type { Server as SocketServer } from "socket.io";

interface MachineContext {
  id: string;
  name: string;
  type: string;
  location: string | null;
  maxVibration: number;
  maxTemp: number;
  baselineVibration: number;
}

interface WorkerContext {
  id: string;
  name: string;
  phone: string;
  role: string | null;
  assignedZone: string | null;
}

interface AnomalyData {
  vibration_rms: number;
  temp_c: number;
  max_vibration: number;
  max_temp: number;
  baseline_vibration: number;
  window_vibration_avg: number;
  window_temp_avg: number;
  exceed_ratio_vibration: number;
  exceed_ratio_temp: number;
}

function generateFallbackMessage(
  machine: MachineContext,
  worker: WorkerContext | null,
  severity: string,
  anomaly: AnomalyData,
): string {
  const workerName = worker ? worker.name : "Operator";
  const vibPercent = (
    (anomaly.vibration_rms / machine.maxVibration) *
    100
  ).toFixed(0);
  const tempPercent = ((anomaly.temp_c / machine.maxTemp) * 100).toFixed(0);

  return (
    `⚠️ [${severity.toUpperCase()}] ${machine.name} (${machine.type}) requires attention.\n` +
    `${workerName}, vibration is at ${vibPercent}% of max (${anomaly.vibration_rms.toFixed(2)} mm/s), ` +
    `temperature at ${tempPercent}% of max (${anomaly.temp_c.toFixed(1)}°C).\n` +
    `Location: ${machine.location || "Unknown"}. Please investigate immediately.`
  );
}

async function callAiService(
  machine: MachineContext,
  worker: WorkerContext | null,
  severity: string,
  anomaly: AnomalyData,
): Promise<string | null> {
  try {
    const response = await fetch(`${env.AI_SERVICE_URL}/generate-alert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machine: {
          name: machine.name,
          type: machine.type,
          location: machine.location,
          baseline_vibration: machine.baselineVibration,
          max_vibration: machine.maxVibration,
          max_temp: machine.maxTemp,
        },
        worker: worker
          ? { name: worker.name, role: worker.role }
          : { name: "Operator", role: "Technician" },
        anomaly,
        severity,
      }),
      // 10s timeout — don't block the pipeline waiting for AI
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(
        `⚠️  [ALERT] AI service returned ${response.status}: ${response.statusText}`,
      );
      return null;
    }

    const data = (await response.json()) as { message?: string };
    return data.message || null;
  } catch (error) {
    // AI service is offline — expected behavior for offline-first design
    console.warn(
      `⚠️  [ALERT] AI service unreachable — using fallback template`,
    );
    return null;
  }
}

export async function triggerAlert(
  machine: MachineContext,
  worker: WorkerContext | null,
  severity: "warning" | "critical",
  anomalyData: AnomalyData,
  io: SocketServer,
) {
  console.log(`📢 [ALERT] Triggering ${severity} alert for ${machine.name}...`);

  let agentMessage = await callAiService(
    machine,
    worker,
    severity,
    anomalyData,
  );

  if (!agentMessage) {
    agentMessage = generateFallbackMessage(
      machine,
      worker,
      severity,
      anomalyData,
    );
    console.log(`   → Using fallback message (AI offline)`);
  } else {
    console.log(`   → AI persona message received`);
  }

  try {
    const [logEntry] = await db
      .insert(maintenanceLogs)
      .values({
        machineId: machine.id,
        workerId: worker?.id || null,
        severity,
        anomalyData: anomalyData,
        agentMessage,
        status: "pending",
      })
      .returning();

    console.log(`   → Alert logged (id: ${logEntry.id})`);

    const alertPayload = {
      id: logEntry.id,
      machineId: machine.id,
      machineName: machine.name,
      machineType: machine.type,
      workerName: worker?.name || "Unassigned",
      severity,
      agentMessage,
      anomalyData,
      timestamp: logEntry.createdAt?.toISOString() || new Date().toISOString(),
    };

    io.to("alerts:live").emit("alert:new", alertPayload);
    console.log(`   → Alert broadcast to dashboard`);
  } catch (error) {
    console.error(`❌ [ALERT] Failed to log alert:`, error);
  }
}
