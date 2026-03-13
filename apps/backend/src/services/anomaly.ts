// Anomaly Detection Engine
//
// Implements a sliding-window threshold analysis for
// each machine's telemetry stream. Two-tier detection:
//
//   WARNING:  >60% of the last N readings exceed 80%
//             of the machine's max threshold
//   CRITICAL: Any single reading exceeds the max threshold
//
// Includes a cooldown to prevent alert flooding — once
// an alert fires, the same machine won't re-alert for
// COOLDOWN_MS (default: 5 minutes).

import { db } from "../db/connection.js";
import { machines, workers } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { updateMachineStatus } from "./telemetry.js";
import { triggerAlert } from "./alert.js";
import type { Server as SocketServer } from "socket.io";

const WINDOW_SIZE = 10; // --- Configuration ---
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between alerts

// Sliding windows and cooldown timers per machine.
// Stored in memory for speed — this is a local edge node,
// not a distributed system. Process restart resets windows.

interface MachineWindow {
  vibrations: number[];
  temperatures: number[];
  lastAlertTime: number;
  currentStatus: "healthy" | "warning" | "critical";
}

const machineWindows: Map<string, MachineWindow> = new Map();


function getWindow(machineId: string): MachineWindow {
  if (!machineWindows.has(machineId)) {
    machineWindows.set(machineId, {
      vibrations: [],
      temperatures: [],
      lastAlertTime: 0,
      currentStatus: "healthy",
    });
  }
  return machineWindows.get(machineId)!;
}


function pushToWindow(arr: number[], value: number, maxSize: number) {
  arr.push(value);
  if (arr.length > maxSize) {
    arr.shift();
  }
}

// Cache machine configs to avoid DB queries on every reading.
// Refreshed on cache miss (new machine detected).

interface MachineConfig {
  id: string;
  name: string;
  type: string;
  location: string | null;
  maxVibration: number;
  maxTemp: number;
  baselineVibration: number;
}

const machineCache: Map<string, MachineConfig> = new Map();


async function getMachineConfig(
  machineNameOrId: string
): Promise<MachineConfig | null> {
  // Check cache first
  if (machineCache.has(machineNameOrId)) {
    return machineCache.get(machineNameOrId)!;
  }

  // Try lookup by name (ESP32 sends machine name, not UUID)
  const results = await db
    .select()
    .from(machines)
    .where(eq(machines.name, machineNameOrId))
    .limit(1);

  if (results.length === 0) {
    // Try by ID as fallback
    const byId = await db
      .select()
      .from(machines)
      .where(eq(machines.id, machineNameOrId))
      .limit(1);

    if (byId.length === 0) return null;
    const m = byId[0];
    const config: MachineConfig = {
      id: m.id,
      name: m.name,
      type: m.type,
      location: m.location,
      maxVibration: parseFloat(m.maxVibration),
      maxTemp: parseFloat(m.maxTemp),
      baselineVibration: parseFloat(m.baselineVibration),
    };
    machineCache.set(machineNameOrId, config);
    return config;
  }

  const m = results[0];
  const config: MachineConfig = {
    id: m.id,
    name: m.name,
    type: m.type,
    location: m.location,
    maxVibration: parseFloat(m.maxVibration),
    maxTemp: parseFloat(m.maxTemp),
    baselineVibration: parseFloat(m.baselineVibration),
  };
  machineCache.set(machineNameOrId, config);
  return config;
}


async function findAssignedWorker(location: string | null) {
  if (!location) return null;
  const results = await db
    .select()
    .from(workers)
    .where(eq(workers.assignedZone, location))
    .limit(1);
  return results[0] || null;
}



export async function analyzeReading(
  machineId: string,
  vibration: number,
  temp: number,
  io: SocketServer
) {
  const machine = await getMachineConfig(machineId);
  if (!machine) {
    // Unknown machine — skip (don't crash the pipeline)
    return;
  }

  const window = getWindow(machineId);
  pushToWindow(window.vibrations, vibration, WINDOW_SIZE);
  pushToWindow(window.temperatures, temp, WINDOW_SIZE);

  // --- NEW ML ISOLATION FOREST FLOW --- //
  
  // Package the window to send to Python AI Service
  const windowData = window.vibrations.map((v, i) => ({
    vibration_rms: v,
    temp_c: window.temperatures[i],
  }));

  let newStatus: "healthy" | "warning" | "critical" = "healthy";

  try {
    const mlResponse = await fetch(`${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/detect-anomaly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine: {
          baseline_vibration: machine.baselineVibration,
          max_vibration: machine.maxVibration,
          max_temp: machine.maxTemp
        },
        window: windowData
      })
    });

    if (mlResponse.ok) {
      const mlData = await mlResponse.json() as { is_anomaly: boolean, score: number, severity: "healthy" | "warning" | "critical" };
      newStatus = mlData.severity;
      
      // ML provides a negative score for anomalies.
      if (mlData.is_anomaly && mlData.score) {
        console.log(`🧠 [ML] Isolation Forest detected anomaly! Score: ${mlData.score.toFixed(3)}`);
      }
    }
  } catch (error) {
    console.warn("⚠️ [ML] Isolation Forest unreachable, falling back to basic threshold safety nets.");
    if (vibration > machine.maxVibration || temp > machine.maxTemp) {
      newStatus = "critical";
    }
  }

  const previousStatus = window.currentStatus;
  window.currentStatus = newStatus;

  // Only act on escalation (healthy→warning, healthy→critical, warning→critical)
  if (newStatus === "healthy") {
    // Machine recovered — update status in DB
    if (previousStatus !== "healthy") {
      await updateMachineStatus(machine.id, "healthy");
      console.log(`🟢 [ANOMALY] ${machine.name} recovered → HEALTHY`);
    }
    return;
  }

  // Update machine status in DB
  await updateMachineStatus(machine.id, newStatus);

  // Don't flood with alerts for the same machine
  const now = Date.now();
  if (now - window.lastAlertTime < COOLDOWN_MS) {
    return; // Still in cooldown — skip alert
  }

  window.lastAlertTime = now;

  const worker = await findAssignedWorker(machine.location);

  const anomalyData = {
    vibration_rms: vibration,
    temp_c: temp,
    max_vibration: machine.maxVibration,
    max_temp: machine.maxTemp,
    baseline_vibration: machine.baselineVibration,
    window_vibration_avg:
      window.vibrations.reduce((a, b) => a + b, 0) / window.vibrations.length,
    window_temp_avg:
      window.temperatures.reduce((a, b) => a + b, 0) /
      window.temperatures.length,
    exceed_ratio_vibration: 0, // Deprecated by ML
    exceed_ratio_temp: 0,      // Deprecated by ML
  };

  console.log(
    `${newStatus === "critical" ? "🔴" : "🟡"} [ANOMALY] ${machine.name} → ${newStatus.toUpperCase()}`
  );
  console.log(
    `   vib=${vibration.toFixed(2)} (max ${machine.maxVibration}), ` +
      `temp=${temp.toFixed(1)} (max ${machine.maxTemp})`
  );

  // Trigger the alert pipeline (AI service + DB log + Socket.io)
  await triggerAlert(machine, worker, newStatus, anomalyData, io);
}
