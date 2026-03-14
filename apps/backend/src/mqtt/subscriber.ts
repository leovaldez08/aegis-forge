import mqtt from "mqtt";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/connection.js";
import { telemetry, machines } from "../db/schema.js";
import type { Server as SocketServer } from "socket.io";

const TelemetryPayload = z.object({
  machine_id: z.string().min(1),
  vibration_rms: z.number().positive(),
  temp_c: z.number(),
  timestamp: z.string().datetime().optional(),
});

type TelemetryData = z.infer<typeof TelemetryPayload>;

// Machine name → UUID cache (populated on first encounter)
const machineIdCache: Map<string, string> = new Map();

async function resolveMachineUUID(name: string): Promise<string | null> {
  if (machineIdCache.has(name)) return machineIdCache.get(name)!;

  const results = await db
    .select({ id: machines.id })
    .from(machines)
    .where(eq(machines.name, name))
    .limit(1);

  if (results.length === 0) return null;
  machineIdCache.set(name, results[0].id);
  return results[0].id;
}

// Write buffer for batch DB inserts
const FLUSH_INTERVAL_MS = 1000;
let writeBuffer: Array<{
  timestamp: Date;
  machineId: string;
  vibrationRms: string;
  tempC: string;
}> = [];

async function flushBuffer() {
  if (writeBuffer.length === 0) return;
  const batch = [...writeBuffer];
  writeBuffer = [];

  try {
    await db.insert(telemetry).values(batch);
  } catch (error) {
    console.error(`❌ [MQTT] Failed to flush ${batch.length} readings:`, error);
    writeBuffer.unshift(...batch);
  }
}

export function initMqttSubscriber(
  io: SocketServer,
  onTelemetry?: (machineId: string, data: TelemetryData) => void,
) {
  const topic = `${env.MQTT_TOPIC_PREFIX}/#`;
  console.log(`📡 [MQTT] Connecting to broker: ${env.MQTT_BROKER_URL}`);
  console.log(`📡 [MQTT] Subscribing to topic: ${topic}`);

  const client = mqtt.connect(env.MQTT_BROKER_URL, {
    clientId: `aegis-backend-${Date.now()}`,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  client.on("connect", () => {
    console.log("✅ [MQTT] Connected to broker");
    client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) console.error("❌ [MQTT] Subscription failed:", err);
      else console.log(`✅ [MQTT] Subscribed to ${topic}`);
    });
  });

  client.on("reconnect", () => console.log("🔄 [MQTT] Reconnecting..."));
  client.on("error", (err) => console.error("❌ [MQTT] Error:", err.message));

  // Message handler
  client.on("message", (_topic, payload) => {
    try {
      const raw = JSON.parse(payload.toString());
      const result = TelemetryPayload.safeParse(raw);
      if (!result.success) {
        console.warn(
          "⚠️  [MQTT] Invalid payload:",
          result.error.issues.map((i) => i.message).join(", "),
        );
        return;
      }

      const data = result.data;
      const readingTimestamp = data.timestamp
        ? new Date(data.timestamp)
        : new Date();

      // Resolve machine name → UUID, then buffer for DB write
      resolveMachineUUID(data.machine_id).then((uuid) => {
        if (!uuid) {
          console.warn(`⚠️  [MQTT] Unknown machine: ${data.machine_id}`);
          return;
        }

        writeBuffer.push({
          timestamp: readingTimestamp,
          machineId: uuid,
          vibrationRms: data.vibration_rms.toFixed(4),
          tempC: data.temp_c.toFixed(2),
        });
      });

      // Emit to Socket.io immediately (no UUID needed for dashboard)
      io.to("telemetry:live").emit("telemetry:reading", {
        machineId: data.machine_id,
        vibrationRms: data.vibration_rms,
        tempC: data.temp_c,
        timestamp: readingTimestamp.toISOString(),
      });

      // Trigger anomaly detection
      if (onTelemetry) onTelemetry(data.machine_id, data);
    } catch (error) {
      console.warn("⚠️  [MQTT] Parse error:", error);
    }
  });

  const flushInterval = setInterval(flushBuffer, FLUSH_INTERVAL_MS);

  const shutdown = async () => {
    console.log("🛑 [MQTT] Shutting down...");
    clearInterval(flushInterval);
    await flushBuffer();
    client.end(true);
  };

  return { client, shutdown };
}
