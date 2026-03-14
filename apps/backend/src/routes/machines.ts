// Machines API Routes
// GET /api/machines        → List all machines
// GET /api/machines/:id    → Get single machine

import { FastifyInstance } from "fastify";
import { db } from "../db/connection.js";
import { machines } from "../db/schema.js";
import { eq } from "drizzle-orm";

export async function machineRoutes(app: FastifyInstance) {
  // List all machines with current status
  app.get("/api/machines", async () => {
    const allMachines = await db.select().from(machines);
    return { machines: allMachines };
  });

  // Get a single machine by ID
  app.get<{ Params: { id: string } }>(
    "/api/machines/:id",
    async (req, reply) => {
      const machine = await db
        .select()
        .from(machines)
        .where(eq(machines.id, req.params.id))
        .limit(1);

      if (machine.length === 0) {
        return reply.status(404).send({ error: "Machine not found" });
      }
      return { machine: machine[0] };
    },
  );
}
