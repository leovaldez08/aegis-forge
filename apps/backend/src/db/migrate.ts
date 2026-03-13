// Database Migration Runner
//
// Runs Drizzle migrations and then sets up TimescaleDB-
// specific features (hypertable on telemetry table).
//
// Usage: npx tsx src/db/migrate.ts

import { rawSql } from "./connection.js";

async function migrate() {
  console.log("🔧 [AEGIS] Running database migrations...\n");

  try {
    console.log("  → Enabling TimescaleDB extension...");
    try {
      await rawSql`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`;
      console.log("  ✓ TimescaleDB extension enabled\n");
    } catch {
      console.log("  ⚠ TimescaleDB not available — running with standard PostgreSQL");
      console.log("    (Swap Docker image to timescale/timescaledb for hypertable support)\n");
    }

    console.log("  → Creating machines table...");
    await rawSql`
      CREATE TABLE IF NOT EXISTS machines (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(100) NOT NULL UNIQUE,
        type            VARCHAR(50) NOT NULL,
        location        VARCHAR(100),
        baseline_vibration  DECIMAL(6,2) NOT NULL,
        max_vibration       DECIMAL(6,2) NOT NULL,
        max_temp            DECIMAL(5,2) NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'healthy',
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log("  ✓ machines table ready");

    console.log("  → Creating workers table...");
    await rawSql`
      CREATE TABLE IF NOT EXISTS workers (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(100) NOT NULL,
        phone           VARCHAR(20) NOT NULL,
        role            VARCHAR(50) DEFAULT 'technician',
        assigned_zone   VARCHAR(50),
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log("  ✓ workers table ready");

    console.log("  → Creating telemetry table...");
    await rawSql`
      CREATE TABLE IF NOT EXISTS telemetry (
        timestamp       TIMESTAMPTZ NOT NULL,
        machine_id      UUID NOT NULL REFERENCES machines(id),
        vibration_rms   DECIMAL(8,4) NOT NULL,
        temp_c          DECIMAL(6,2) NOT NULL
      )
    `;
    console.log("  ✓ telemetry table ready");

    // If TimescaleDB is available, this enables automatic time-based
    // partitioning. If not, standard PostgreSQL works fine for the MVP.
    console.log("  → Converting telemetry to hypertable...");
    try {
      await rawSql`
        SELECT create_hypertable('telemetry', 'timestamp',
          if_not_exists => TRUE,
          chunk_time_interval => INTERVAL '1 day'
        )
      `;
      console.log("  ✓ telemetry hypertable created (1-day chunks)\n");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("already a hypertable")) {
        console.log("  ✓ telemetry is already a hypertable\n");
      } else {
        // TimescaleDB not installed — skip hypertable, use plain table
        console.log("  ⚠ Hypertable skipped (TimescaleDB not available)\n");
      }
    }

    console.log("  → Creating maintenance_logs table...");
    await rawSql`
      CREATE TABLE IF NOT EXISTS maintenance_logs (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        machine_id      UUID NOT NULL REFERENCES machines(id),
        worker_id       UUID REFERENCES workers(id),
        severity        VARCHAR(20) NOT NULL,
        anomaly_data    JSONB NOT NULL,
        agent_message   TEXT NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log("  ✓ maintenance_logs table ready");

    console.log("\n  → Creating indexes...");
    await rawSql`
      CREATE INDEX IF NOT EXISTS idx_telemetry_machine_time
        ON telemetry (machine_id, timestamp DESC)
    `;
    await rawSql`
      CREATE INDEX IF NOT EXISTS idx_maintenance_logs_machine
        ON maintenance_logs (machine_id, created_at DESC)
    `;
    await rawSql`
      CREATE INDEX IF NOT EXISTS idx_maintenance_logs_status
        ON maintenance_logs (status)
    `;
    console.log("  ✓ Indexes created\n");

    console.log("══════════════════════════════════════════");
    console.log("  ✅ All migrations completed successfully");
    console.log("══════════════════════════════════════════\n");
  } catch (error) {
    console.error("\n  ❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await rawSql.end();
  }
}

migrate();
