import { eq, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";

import { normalizeHandle } from "../auth/crypto.js";
import { requireDirectoryAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { directoryCards, handles, profiles } from "../db/schema.js";

export const directoryRoutes = new Hono();

function cardToAgent(row: typeof directoryCards.$inferSelect) {
  const card = row.card as Record<string, unknown>;
  return {
    agentId: row.agentId,
    name: String(card["name"] ?? row.handle ?? row.agentId),
    description: typeof card["description"] === "string" ? card["description"] : undefined,
    username: row.handle,
    cryptoId: row.agentId,
    publicKey: typeof card["publicKey"] === "string" ? card["publicKey"] : undefined,
    skills: Array.isArray(card["skills"]) ? (card["skills"] as Array<string>) : [],
    tags: row.tags ?? [],
    metadata: (card["metadata"] as Record<string, string> | undefined) ?? {},
    createdAt: row.publishedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

directoryRoutes.get("/directory/agents", async (c) => {
  const q = c.req.query("q")?.trim();
  const limit = Number(c.req.query("limit") ?? "50");
  const cards = q
    ? await db
        .select()
        .from(directoryCards)
        .where(
          or(
            ilike(directoryCards.handle, `%${q}%`),
            sql`${directoryCards.card}::text ILIKE ${`%${q}%`}`,
          ),
        )
        .limit(limit)
    : await db.select().from(directoryCards).limit(limit);
  return c.json({ agents: cards.map(cardToAgent) });
});

directoryRoutes.get("/directory/agents/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const card = await db.query.directoryCards.findFirst({
    where: eq(directoryCards.agentId, agentId),
  });
  if (!card) return c.json({ error: "Agent not found" }, 404);
  return c.json(cardToAgent(card));
});

directoryRoutes.get("/directory/resolve/:name", async (c) => {
  const name = normalizeHandle(c.req.param("name"));
  const handle = await db.query.handles.findFirst({ where: eq(handles.name, name) });
  if (!handle) return c.json({ error: "Handle not found" }, 404);
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.agentId, handle.agentId),
  });
  return c.json({
    username: handle.name,
    cryptoId: handle.agentId,
    publicKey: handle.agentId,
    bio: profile?.bio ?? "",
    status: handle.status,
  });
});

directoryRoutes.put("/directory/agents/:agentId", requireDirectoryAuth, async (c) => {
  const agentId = c.req.param("agentId");
  const body = z.record(z.unknown()).parse(await c.req.json());
  const existing = await db.query.directoryCards.findFirst({
    where: eq(directoryCards.agentId, agentId),
  });
  const card = {
    ...(existing?.card as Record<string, unknown> | undefined),
    ...body,
    agentId,
    cryptoId: agentId,
  };
  if (existing) {
    await db
      .update(directoryCards)
      .set({
        card,
        handle: typeof body["username"] === "string" ? body["username"] : existing.handle,
        tags: Array.isArray(body["tags"]) ? (body["tags"] as Array<string>) : existing.tags,
        updatedAt: new Date(),
      })
      .where(eq(directoryCards.id, existing.id));
  } else {
    await db.insert(directoryCards).values({
      id: nanoid(),
      agentId,
      handle: typeof body["username"] === "string" ? body["username"] : undefined,
      card,
      tags: Array.isArray(body["tags"]) ? (body["tags"] as Array<string>) : [],
    });
  }
  const saved = await db.query.directoryCards.findFirst({
    where: eq(directoryCards.agentId, agentId),
  });
  return c.json(cardToAgent(saved!));
});

directoryRoutes.get("/directory/search", async (c) => {
  const q = c.req.query("q")?.trim();
  const limit = Number(c.req.query("limit") ?? "20");
  const cards = q
    ? await db
        .select()
        .from(directoryCards)
        .where(
          or(
            ilike(directoryCards.handle, `%${q}%`),
            sql`${directoryCards.card}::text ILIKE ${`%${q}%`}`,
          ),
        )
        .limit(limit)
    : await db.select().from(directoryCards).limit(limit);
  return c.json({
    results: cards.map((row) => ({
      agentId: row.agentId,
      handle: row.handle,
      card: row.card,
      tags: row.tags,
      publishedAt: row.publishedAt.toISOString(),
    })),
  });
});

directoryRoutes.get("/directory/reverse/:cryptoId", async (c) => {
  const cryptoId = c.req.param("cryptoId");
  const rows = await db.select().from(handles).where(eq(handles.agentId, cryptoId));
  return c.json({
    cryptoId,
    identities: rows.map((row) => ({
      username: row.name,
      cryptoId: row.agentId,
      publicKey: row.agentId,
      registeredAt: row.registeredAt?.toISOString() ?? row.createdAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? row.createdAt.toISOString(),
      status: row.status === "active" ? "active" : "pending",
      registrationTx: row.chainTxHash,
      primary: true,
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
});

directoryRoutes.get("/directory/reverse", async (c) => {
  const cryptoId = c.req.query("cryptoId");
  if (!cryptoId) return c.json({ identities: [] });
  const rows = await db.select().from(handles).where(eq(handles.agentId, cryptoId));
  return c.json({
    cryptoId,
    identities: rows.map((row) => ({
      username: row.name,
      cryptoId: row.agentId,
      publicKey: row.agentId,
      registeredAt: row.registeredAt?.toISOString() ?? row.createdAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? row.createdAt.toISOString(),
      status: row.status === "active" ? "active" : "pending",
      registrationTx: row.chainTxHash,
      primary: true,
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
});

directoryRoutes.put("/directory/cards/:agentId", requireDirectoryAuth, async (c) => {
  const agentId = c.req.param("agentId");
  const body = z
    .object({
      card: z.record(z.unknown()),
      skillMd: z.string().optional(),
      handle: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .parse(await c.req.json());
  const existing = await db.query.directoryCards.findFirst({
    where: eq(directoryCards.agentId, agentId),
  });
  if (existing) {
    await db
      .update(directoryCards)
      .set({
        card: body.card,
        skillMd: body.skillMd,
        handle: body.handle,
        tags: body.tags ?? [],
        updatedAt: new Date(),
      })
      .where(eq(directoryCards.id, existing.id));
  } else {
    await db.insert(directoryCards).values({
      id: nanoid(),
      agentId,
      handle: body.handle,
      card: body.card,
      skillMd: body.skillMd,
      tags: body.tags ?? [],
    });
  }
  return c.json({ agentId, published: true });
});

directoryRoutes.get("/directory/cards/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const card = await db.query.directoryCards.findFirst({
    where: eq(directoryCards.agentId, agentId),
  });
  if (!card) return c.json({ error: "Card not found" }, 404);
  return c.json({
    agentId: card.agentId,
    handle: card.handle,
    card: card.card,
    skillMd: card.skillMd,
    tags: card.tags,
    publishedAt: card.publishedAt.toISOString(),
  });
});
