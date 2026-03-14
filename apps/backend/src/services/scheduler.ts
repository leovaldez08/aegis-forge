import { db } from "../db/connection.js";
import { machines, telemetry, workers } from "../db/schema.js";
import { triggerAlert } from "./alert.js";
import { sql } from "drizzle-orm";
import type { Server as SocketServer } from "socket.io";

const TREND_INTERVAL_MS = 60 * 1000; // Check every 60 seconds for the demo

export function initScheduler(io: SocketServer) {
  console.log("🕒 [SCHEDULER] Predictive Trend Scheduler started.");

  setInterval(async () => {
    try {
      // Get all active machines
      const allMachines = await db.select().from(machines);

      for (const machine of allMachines) {
        // We will simulate a long-term trend check by comparing the average vibration
        // over the last 30 seconds vs the machine's absolute baseline.
        // In a real prod TimescaleDB, this would use a Continuous Aggregate over days.
        const recentStats = await db
          .select({
            avgVib: sql<number>`AVG(${telemetry.vibrationRms})`,
          })
          .from(telemetry)
          .where(
            sql`${telemetry.machineId} = ${machine.id} AND ${telemetry.timestamp} >= NOW() - INTERVAL '30 seconds'`,
          );

        if (!recentStats[0] || recentStats[0].avgVib === null) continue;

        const currentAvg = Number(recentStats[0].avgVib);
        const baseline = Number(machine.baselineVibration);
        const maxVib = Number(machine.maxVibration);

        // If the current average is steadily > 15% over baseline, but not yet critical
        // Suggest a scheduled maintenance before it hits max.
        const degradationThreshold = baseline * 1.15;

        if (currentAvg > degradationThreshold && currentAvg < maxVib) {
          // Fetch an assigned worker
          const allWorkers = await db.select().from(workers);
          const assignedWorker = allWorkers[0];

          if (!assignedWorker) continue;

          console.log(
            `📉 [TREND] Degradation detected on ${machine.name}. Triggering predictive AI alert.`,
          );

          const anomalyData = {
            vibration_rms: parseFloat(currentAvg.toFixed(4)),
            temp_c: 40.0, // Mock temperature for baseline degradation
            max_vibration: maxVib,
            max_temp: Number(machine.maxTemp),
            baseline_vibration: baseline,
            window_vibration_avg: currentAvg,
            window_temp_avg: 40.0,
            exceed_ratio_vibration: 0,
            exceed_ratio_temp: 0,
          };

          const machineContext = {
            id: machine.id,
            name: machine.name,
            type: machine.type,
            location: machine.location,
            baselineVibration: baseline,
            maxVibration: maxVib,
            maxTemp: Number(machine.maxTemp),
            status: machine.status,
          };

          // Trigger the AI to write a message
          await triggerAlert(
            machineContext as any,
            assignedWorker,
            "warning",
            anomalyData as any,
            io,
          );
        }
      }
    } catch (error) {
      console.error("❌ [SCHEDULER] Error running trend analysis:", error);
    }
  }, TREND_INTERVAL_MS);
}
