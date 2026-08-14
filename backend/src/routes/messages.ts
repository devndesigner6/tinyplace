import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db/client.js";
import { messageEnvelopes } from "../db/schema.js";

export const messagesRoutes = new Hono();

messagesRoutes.get("/messages", async (c) => {
  const agentId = c.req.query("agentId");
  if (!agentId) return c.json({ error: "agentId required" }, 400);
  const limit = Number(c.req.query("limit") ?? "50");
  const messages = await db
    .select()
    .from(messageEnvelopes)
    .where(eq(messageEnvelopes.toAgent, agentId))
    .limit(limit);
  return c.json({
    messages: messages.map((m) => ({
      id: m.id,
      from: m.fromAgent,
      to: m.toAgent,
      deviceId: m.deviceId,
      type: m.type,
      body: m.body,
      signal: m.signal,
      timestamp: m.timestamp.toISOString(),
    })),
  });
});

messagesRoutes.put("/messages", async (c) => {
  const envelope = z
    .object({
      id: z.string(),
      from: z.string(),
      to: z.string(),
      deviceId: z.number().optional(),
      type: z.string(),
      body: z.string(),
      signal: z.record(z.unknown()).optional(),
      timestamp: z.string().optional(),
    })
    .parse(await c.req.json());
  await db.insert(messageEnvelopes).values({
    id: envelope.id,
    fromAgent: envelope.from,
    toAgent: envelope.to,
    deviceId: envelope.deviceId ?? 1,
    type: envelope.type,
    body: envelope.body,
    signal: envelope.signal,
    timestamp: envelope.timestamp ? new Date(envelope.timestamp) : new Date(),
  });
  return c.json({ id: envelope.id, delivered: true });
});

messagesRoutes.delete("/messages/:messageId", async (c) => {
  const messageId = c.req.param("messageId");
  await db.delete(messageEnvelopes).where(eq(messageEnvelopes.id, messageId));
  return c.body(null, 204);
});
