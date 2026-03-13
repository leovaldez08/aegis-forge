// Database Seed Script — Aegis Node
//
// Populates the database with realistic dummy data:
//   • 4 industrial machines with calibrated baselines
//   • 3 factory workers assigned to different zones
//
// Usage: npx tsx src/db/seed.ts

import { db, rawSql } from "./connection.js";
import { machines, workers } from "./schema.js";



const seedMachines = [
  {
    name: "CNC_Lathe_01",
    type: "CNC Lathe",
    location: "Zone A - Machining Bay",
    baselineVibration: "4.50", // Normal operating vibration (mm/s RMS)
    maxVibration: "11.20", // ISO 10816 "Danger" threshold
    maxTemp: "85.00", // Max bearing temperature
    status: "healthy" as const,
  },
  {
    name: "Hydraulic_Press_01",
    type: "Hydraulic Press",
    location: "Zone B - Forming Area",
    baselineVibration: "2.80",
    maxVibration: "7.10",
    maxTemp: "75.00",
    status: "healthy" as const,
  },
  {
    name: "Conveyor_Belt_03",
    type: "Conveyor System",
    location: "Zone C - Assembly Line",
    baselineVibration: "1.20",
    maxVibration: "4.50",
    maxTemp: "60.00",
    status: "healthy" as const,
  },
  {
    name: "Welding_Robot_02",
    type: "Robotic Welder",
    location: "Zone A - Machining Bay",
    baselineVibration: "3.10",
    maxVibration: "8.00",
    maxTemp: "95.00", // Welding robots run hotter
    status: "healthy" as const,
  },
];


const seedWorkers = [
  {
    name: "Marcus Rodriguez",
    phone: "+1-555-0101",
    role: "Senior Technician",
    assignedZone: "Zone A - Machining Bay",
  },
  {
    name: "Priya Sharma",
    phone: "+1-555-0102",
    role: "Maintenance Engineer",
    assignedZone: "Zone B - Forming Area",
  },
  {
    name: "James O'Brien",
    phone: "+1-555-0103",
    role: "Technician",
    assignedZone: "Zone C - Assembly Line",
  },
];


async function seed() {
  console.log("🌱 [AEGIS] Seeding database...\n");

  try {
    // Clear existing data (safe for dev — CASCADE handles FK constraints)
    console.log("  → Clearing existing data...");
    await db.delete(machines);
    await db.delete(workers);
    console.log("  ✓ Tables cleared\n");

    // Insert machines
    console.log("  → Inserting machines...");
    const insertedMachines = await db
      .insert(machines)
      .values(seedMachines)
      .returning();

    for (const m of insertedMachines) {
      console.log(
        `    • ${m.name} (${m.type}) → baseline: ${m.baselineVibration} mm/s, max: ${m.maxVibration} mm/s, ${m.maxTemp}°C`
      );
    }
    console.log(`  ✓ ${insertedMachines.length} machines inserted\n`);

    // Insert workers
    console.log("  → Inserting workers...");
    const insertedWorkers = await db
      .insert(workers)
      .values(seedWorkers)
      .returning();

    for (const w of insertedWorkers) {
      console.log(`    • ${w.name} (${w.role}) → ${w.assignedZone}`);
    }
    console.log(`  ✓ ${insertedWorkers.length} workers inserted\n`);

    console.log("══════════════════════════════════════════");
    console.log("  ✅ Database seeded successfully");
    console.log("══════════════════════════════════════════\n");
  } catch (error) {
    console.error("\n  ❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await rawSql.end();
  }
}

seed();
