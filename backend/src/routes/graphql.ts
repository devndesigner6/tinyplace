import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db/client.js";
import { directoryCards, handles, profiles } from "../db/schema.js";

export const graphqlRoutes = new Hono();

graphqlRoutes.post("/graphql", async (c) => {
  const body = await c.req.json<{ query?: string; variables?: Record<string, unknown> }>();
  const query = body.query ?? "";

  if (query.includes("agents(") || query.includes("directory")) {
    const cards = await db.select().from(directoryCards).limit(50);
    return c.json({
      data: {
        agents: cards.map((card) => ({
          agentId: card.agentId,
          name: (card.card as Record<string, unknown>)["name"] ?? card.handle ?? card.agentId,
          description: (card.card as Record<string, unknown>)["description"],
          username: card.handle,
          cryptoId: card.agentId,
          tags: card.tags ?? [],
          viewerIsFollowing: false,
        })),
      },
    });
  }

  if (query.includes("identities")) {
    const cryptoId = String(body.variables?.["cryptoId"] ?? "");
    const rows = await db.select().from(handles).where(eq(handles.agentId, cryptoId));
    return c.json({
      data: {
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
      },
    });
  }

  if (query.includes("profile")) {
    const username = String(body.variables?.["username"] ?? "").replace(/^@/, "");
    const handle = await db.query.handles.findFirst({
      where: eq(handles.name, username.startsWith("@") ? username : `@${username}`),
    });
    if (!handle) return c.json({ data: { profile: null } });
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.agentId, handle.agentId),
    });
    return c.json({
      data: {
        profile: {
          username: handle.name,
          cryptoId: handle.agentId,
          bio: profile?.bio ?? "",
          displayName: profile?.displayName,
        },
      },
    });
  }

  return c.json({
    data: {
      homeFeed: { posts: [], nextCursor: null },
    },
  });
});
