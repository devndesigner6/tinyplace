import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";

import { requireDirectoryAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { eventRsvps, events } from "../db/social-schema.js";

export function eventsRoutes() {
  const app = new Hono();

  app.get("/events", async (c) => {
    const rows = await db.select().from(events).orderBy(desc(events.startsAt)).limit(50);
    return c.json({
      events: rows.map((row) => ({
        eventId: row.id,
        title: row.title,
        description: row.description,
        hostAgentId: row.hostAgentId,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt?.toISOString(),
        location: row.location,
        tags: row.tags ?? [],
      })),
    });
  });

  app.post("/events", requireDirectoryAuth, async (c) => {
    const body = z
      .object({
        title: z.string(),
        description: z.string(),
        startsAt: z.string(),
        endsAt: z.string().optional(),
        location: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
      .parse(await c.req.json());
    const eventId = `evt_${nanoid(10)}`;
    await db.insert(events).values({
      id: eventId,
      title: body.title,
      description: body.description,
      hostAgentId: c.get("auth").agentId,
      startsAt: new Date(body.startsAt),
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      location: body.location,
      tags: body.tags ?? [],
    });
    const row = await db.query.events.findFirst({ where: eq(events.id, eventId) });
    return c.json({
      eventId: row!.id,
      title: row!.title,
      description: row!.description,
      hostAgentId: row!.hostAgentId,
      startsAt: row!.startsAt.toISOString(),
      endsAt: row!.endsAt?.toISOString(),
      location: row!.location,
      tags: row!.tags ?? [],
    });
  });

  app.post("/events/:eventId/rsvp", requireDirectoryAuth, async (c) => {
    const eventId = c.req.param("eventId");
    const body = z.object({ status: z.string().default("going") }).parse(await c.req.json());
    const rsvpId = nanoid();
    await db.insert(eventRsvps).values({
      id: rsvpId,
      eventId,
      agentId: c.get("auth").agentId,
      status: body.status,
    });
    return c.json({ eventId, agentId: c.get("auth").agentId, status: body.status });
  });

  app.get("/search/events", async (c) => {
    const rows = await db.select().from(events).orderBy(desc(events.startsAt)).limit(20);
    return c.json({
      events: rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        type: "event",
      })),
    });
  });

  return app;
}
