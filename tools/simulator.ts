// ─────────────────────────────────────────────────────
// ESP32 Telemetry Simulator
//
// Simulates 4 industrial machines publishing telemetry
// data to the MQTT broker. Used for development and
// testing the full ingestion → anomaly → alert pipeline.
//
// Features:
//   • Normal operation: readings ±10% around baseline
//   • Anomaly injection: periodic spikes above thresholds
//   • Configurable interval (default: 2s per cycle)
//
// Usage: npx tsx tools/simulator.ts
// ─────────────────────────────────────────────────────

import mqtt from "mqtt";

// ── Configuration ─────────────────────────────────────

const BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || "aegis/telemetry";
const PUBLISH_INTERVAL_MS = 2000; // 2 seconds between readings

// Machine definitions matching the seed data
const MACHINES = [
  {
    id: "CNC_Lathe_01",
    baselineVibration: 4.5,
    maxVibration: 11.2,
    baselineTemp: 55,
    maxTemp: 85,
  },
  {
    id: "Hydraulic_Press_01",
    baselineVibration: 2.8,
    maxVibration: 7.1,
    baselineTemp: 48,
    maxTemp: 75,
  },
  {
    id: "Conveyor_Belt_03",
    baselineVibration: 1.2,
    maxVibration: 4.5,
    baselineTemp: 35,
    maxTemp: 60,
  },
  {
    id: "Welding_Robot_02",
    baselineVibration: 3.1,
    maxVibration: 8.0,
    baselineTemp: 62,
    maxTemp: 95,
  },
];

// ── Simulation Logic ──────────────────────────────────

/**
 * Generates a value with Gaussian noise around a baseline.
 * @param baseline - Normal operating value
 * @param jitterPercent - Noise as percentage of baseline (default: 10%)
 */
function normalReading(baseline: number, jitterPercent = 0.1): number {
  const jitter = baseline * jitterPercent * (Math.random() * 2 - 1);
  return Math.max(0, baseline + jitter);
}

/**
 * Generates a value that exceeds the threshold — simulates a failing component.
 * @param max - Machine's critical threshold
 * @param overshootPercent - How far above threshold to spike (default: 10-30%)
 */
function anomalyReading(max: number, overshootPercent = 0.2): number {
  const overshoot = max * (0.1 + Math.random() * overshootPercent);
  return max + overshoot;
}

// Track anomaly state per machine for realistic degradation patterns
const machineState: Record<string, { anomalyCounter: number; isAnomalous: boolean }> = {};

for (const m of MACHINES) {
  machineState[m.id] = { anomalyCounter: 0, isAnomalous: false };
}

// ── MQTT Client ───────────────────────────────────────

console.log(`\n🏭 ═══════════════════════════════════════════`);
console.log(`   AEGIS NODE — ESP32 Telemetry Simulator`);
console.log(`   Broker: ${BROKER_URL}`);
console.log(`   Machines: ${MACHINES.length}`);
console.log(`   Interval: ${PUBLISH_INTERVAL_MS}ms`);
console.log(`🏭 ═══════════════════════════════════════════\n`);

const client = mqtt.connect(BROKER_URL, {
  clientId: `aegis-simulator-${Date.now()}`,
  clean: true,
  reconnectPeriod: 5000,
});

client.on("connect", () => {
  console.log("✅ [SIMULATOR] Connected to MQTT broker\n");

  let cycleCount = 0;

  const interval = setInterval(() => {
    cycleCount++;

    for (const machine of MACHINES) {
      const state = machineState[machine.id];

      // Every ~30 cycles (~1 min), randomly trigger an anomaly period
      // for one machine. The anomaly lasts for 5-8 cycles to simulate
      // a developing fault (not just a single spike).
      if (!state.isAnomalous && cycleCount % 30 === 0 && Math.random() > 0.6) {
        state.isAnomalous = true;
        state.anomalyCounter = 5 + Math.floor(Math.random() * 4);
        console.log(
          `🔴 [SIMULATOR] ${machine.id} entering ANOMALY mode for ${state.anomalyCounter} readings`
        );
      }

      let vibration: number;
      let temp: number;
      let label: string;

      if (state.isAnomalous && state.anomalyCounter > 0) {
        // Anomalous readings — exceeding thresholds
        vibration = anomalyReading(machine.maxVibration, 0.15);
        temp = anomalyReading(machine.maxTemp, 0.1);
        state.anomalyCounter--;
        label = "⚠️  ANOMALY";

        if (state.anomalyCounter === 0) {
          state.isAnomalous = false;
          console.log(
            `🟢 [SIMULATOR] ${machine.id} returning to NORMAL operation`
          );
        }
      } else {
        // Normal readings — baseline ±10%
        vibration = normalReading(machine.baselineVibration);
        temp = normalReading(machine.baselineTemp);
        label = "   NORMAL ";
      }

      const payload = {
        machine_id: machine.id,
        vibration_rms: parseFloat(vibration.toFixed(4)),
        temp_c: parseFloat(temp.toFixed(2)),
        timestamp: new Date().toISOString(),
      };

      const topic = `${TOPIC_PREFIX}/${machine.id}`;
      client.publish(topic, JSON.stringify(payload), { qos: 1 });

      // Compact log: [cycle] status MACHINE vib=X.XX temp=XX.X
      console.log(
        `  [${String(cycleCount).padStart(4, "0")}] ${label} ${machine.id.padEnd(22)} ` +
          `vib=${vibration.toFixed(2).padStart(6)} mm/s  temp=${temp.toFixed(1).padStart(5)}°C`
      );
    }

    console.log(""); // Blank line between cycles
  }, PUBLISH_INTERVAL_MS);

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 [SIMULATOR] Shutting down...");
    clearInterval(interval);
    client.end(true, () => {
      console.log("🛑 [SIMULATOR] Disconnected from broker");
      process.exit(0);
    });
  });
});

client.on("error", (err) => {
  console.error("❌ [SIMULATOR] MQTT error:", err.message);
});

client.on("reconnect", () => {
  console.log("🔄 [SIMULATOR] Reconnecting to broker...");
});
