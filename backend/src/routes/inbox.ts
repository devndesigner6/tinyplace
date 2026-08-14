import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";

import { db } from "../db/client.js";
import { inboxItems } from "../db/schema.js";

export const inboxRoutes = new Hono();

inboxRoutes.get("/inbox", async (c) => {
  const agentId = c.req.query("agentId");
  if (!agentId) return c.json({ error: "agentId required" }, 400);
  const items = await db
    .select()
    .from(inboxItems)
    .where(eq(inboxItems.agentId, agentId));
  return c.json({
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      body: item.body,
      status: item.status,
      metadata: item.metadata,
      createdAt: item.createdAt.toISOString(),
      readAt: item.readAt?.toISOString(),
    })),
  });
});

inboxRoutes.put("/inbox/:itemId/read", async (c) => {
  const itemId = c.req.param("itemId");
  await db
    .update(inboxItems)
    .set({ status: "read", readAt: new Date() })
    .where(eq(inboxItems.id, itemId));
  return c.json({ id: itemId, status: "read" });
});

export async function createInboxItem(input: {
  agentId: string;
  type: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(inboxItems).values({
    id: nanoid(),
    agentId: input.agentId,
    type: input.type,
    title: input.title,
    body: input.body,
    metadata: input.metadata ?? {},
  });
}
