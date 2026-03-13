// Drizzle ORM Schema — Aegis Node Database

import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
  text,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Machines — physical equipment on the factory floor
export const machines = pgTable("machines", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  type: varchar("type", { length: 50 }).notNull(),
  location: varchar("location", { length: 100 }),
  baselineVibration: decimal("baseline_vibration", {
    precision: 6,
    scale: 2,
  }).notNull(),
  maxVibration: decimal("max_vibration", {
    precision: 6,
    scale: 2,
  }).notNull(),
  maxTemp: decimal("max_temp", { precision: 5, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).default("healthy").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Workers — factory technicians assigned to zones
export const workers = pgTable("workers", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  role: varchar("role", { length: 50 }).default("technician"),
  assignedZone: varchar("assigned_zone", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Telemetry — high-frequency sensor readings (TimescaleDB hypertable candidate)
export const telemetry = pgTable("telemetry", {
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  machineId: uuid("machine_id")
    .notNull()
    .references(() => machines.id),
  vibrationRms: decimal("vibration_rms", {
    precision: 8,
    scale: 4,
  }).notNull(),
  tempC: decimal("temp_c", { precision: 6, scale: 2 }).notNull(),
});

// Maintenance Logs — AI-generated alerts from anomaly detection
export const maintenanceLogs = pgTable("maintenance_logs", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  machineId: uuid("machine_id")
    .notNull()
    .references(() => machines.id),
  workerId: uuid("worker_id").references(() => workers.id),
  severity: varchar("severity", { length: 20 }).notNull(),
  anomalyData: jsonb("anomaly_data").notNull(),
  agentMessage: text("agent_message").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type Machine = typeof machines.$inferSelect;
export type NewMachine = typeof machines.$inferInsert;
export type Worker = typeof workers.$inferSelect;
export type NewWorker = typeof workers.$inferInsert;
export type TelemetryReading = typeof telemetry.$inferSelect;
export type NewTelemetryReading = typeof telemetry.$inferInsert;
export type MaintenanceLog = typeof maintenanceLogs.$inferSelect;
export type NewMaintenanceLog = typeof maintenanceLogs.$inferInsert;
