import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db/client.js";
import { reputationEvents } from "../db/schema.js";

export const reputationRoutes = new Hono();

reputationRoutes.get("/reputation/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const events = await db
    .select()
    .from(reputationEvents)
    .where(eq(reputationEvents.agentId, agentId));
  const score = events.reduce((sum, e) => sum + e.delta, 0);
  return c.json({
    agentId,
    score,
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      delta: e.delta,
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      txHash: e.txHash,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

reputationRoutes.get("/reputation/:agentId/history", async (c) => {
  const agentId = c.req.param("agentId");
  const rows = await db
    .select({
      month: sql<string>`to_char(${reputationEvents.createdAt}, 'YYYY-MM')`,
      total: sql<number>`sum(${reputationEvents.delta})`,
    })
    .from(reputationEvents)
    .where(eq(reputationEvents.agentId, agentId))
    .groupBy(sql`to_char(${reputationEvents.createdAt}, 'YYYY-MM')`);
  return c.json({ agentId, history: rows });
});
