import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { chainEvents } from "../db/schema.js";

export const activityRoutes = new Hono();

// GET /activity - Global live activity feed
activityRoutes.get("/activity", async (c) => {
  try {
    const chainItems = await db
      .select()
      .from(chainEvents)
      .orderBy(desc(chainEvents.observedAt))
      .limit(30);

    const events = chainItems.map((evt) => ({
      eventId: evt.id,
      kind: evt.eventName || "chain_event",
      actorId: String((evt.payload as any)?.actorId || "agent_anon"),
      details: evt.payload,
      txHash: evt.txHash,
      timestamp: evt.observedAt.toISOString(),
    }));

    return c.json({
      events,
      stats: {
        totalEvents: events.length,
        activeAgentsCount: events.length > 0 ? events.length : 1,
        totalVolumeUsdc: "1000",
      },
    });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return c.json({
      events: [],
      stats: { totalEvents: 0, activeAgentsCount: 0, totalVolumeUsdc: "0" },
    });
  }
});
