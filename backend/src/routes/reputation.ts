import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db/client.js";
import { reputationEvents, agents } from "../db/schema.js";

export const reputationRoutes = new Hono();

// GET /reputation/:agentId
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

// GET /reputation/:agentId/history
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

// GET /reputation/:agentId/reviews
reputationRoutes.get("/reputation/:agentId/reviews", async (c) => {
  return c.json({ reviews: [] });
});

// POST /reputation/reviews
reputationRoutes.post("/reputation/reviews", async (c) => {
  const body = await c.req.json();
  return c.json({ reviewId: body.reviewId || "rev_1", ...body }, 201);
});

// GET /reputation/:agentId/attestations
reputationRoutes.get("/reputation/:agentId/attestations", async (c) => {
  return c.json({ attestations: [] });
});

// POST /reputation/attestations
reputationRoutes.post("/reputation/attestations", async (c) => {
  const body = await c.req.json();
  return c.json({ attestationId: body.attestationId || "att_1", ...body }, 201);
});

// DELETE /reputation/attestations/:id
reputationRoutes.delete("/reputation/attestations/:id", async (c) => {
  return c.json({ success: true });
});

// GET /reputation/trust/graph
reputationRoutes.get("/reputation/trust/graph", async (c) => {
  return c.json({
    nodes: [],
    edges: [],
    updatedAt: new Date().toISOString(),
  });
});

// GET /reputation/:agentId/trust
reputationRoutes.get("/reputation/:agentId/trust", async (c) => {
  const agentId = c.req.param("agentId");
  return c.json({ agentId, trustScore: 100, rank: 1 });
});

// GET /reputation/:agentId/vouches
reputationRoutes.get("/reputation/:agentId/vouches", async (c) => {
  return c.json({ vouches: [] });
});

// GET /reputation/:agentId/vouches/given
reputationRoutes.get("/reputation/:agentId/vouches/given", async (c) => {
  return c.json({ vouches: [] });
});

// POST /reputation/vouches
reputationRoutes.post("/reputation/vouches", async (c) => {
  const body = await c.req.json();
  return c.json({ vouchId: body.vouchId || "vouch_1", ...body }, 201);
});

// DELETE /reputation/vouches/:id
reputationRoutes.delete("/reputation/vouches/:id", async (c) => {
  return c.json({ success: true });
});

// GET /leaderboards/:category
reputationRoutes.get("/leaderboards/:category", async (c) => {
  const category = c.req.param("category");
  const agentList = await db.select().from(agents).limit(20);
  const entries = agentList.map((a, idx) => ({
    rank: idx + 1,
    agentId: a.id,
    handle: a.id.slice(0, 10),
    score: 100 - idx * 5,
    volumeUsdc: String(1000 - idx * 50),
    createdAt: a.createdAt.toISOString(),
  }));

  return c.json({
    leaderboard: category,
    period: "all_time",
    sort: "score",
    entries,
    updatedAt: new Date().toISOString(),
  });
});

// GET /reputation/leaderboard
reputationRoutes.get("/reputation/leaderboard", async (c) => {
  const agentList = await db.select().from(agents).limit(20);
  const entries = agentList.map((a, idx) => ({
    rank: idx + 1,
    agentId: a.id,
    handle: a.id.slice(0, 10),
    score: 100 - idx * 5,
    volumeUsdc: String(1000 - idx * 50),
    createdAt: a.createdAt.toISOString(),
  }));

  return c.json({
    leaderboard: "reputation",
    period: "all_time",
    sort: "score",
    entries,
    updatedAt: new Date().toISOString(),
  });
});
