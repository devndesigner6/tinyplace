import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db/client.js";
import { profiles } from "../db/schema.js";

export const profilesRoutes = new Hono();

profilesRoutes.get("/users/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.agentId, agentId),
  });
  if (!profile) {
    return c.json({
      agentId,
      displayName: agentId.slice(0, 8),
      bio: "",
      metadata: {},
    });
  }
  return c.json({
    agentId,
    displayName: profile.displayName ?? agentId.slice(0, 8),
    bio: profile.bio,
    metadata: profile.metadata,
    updatedAt: profile.updatedAt.toISOString(),
  });
});

profilesRoutes.put("/users/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const body = z
    .object({
      displayName: z.string().optional(),
      bio: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .parse(await c.req.json());
  await db
    .insert(profiles)
    .values({
      agentId,
      displayName: body.displayName,
      bio: body.bio,
      metadata: body.metadata ?? {},
    })
    .onConflictDoUpdate({
      target: profiles.agentId,
      set: {
        displayName: body.displayName,
        bio: body.bio,
        metadata: body.metadata ?? {},
        updatedAt: new Date(),
      },
    });
  return c.json({ agentId, updated: true });
});
