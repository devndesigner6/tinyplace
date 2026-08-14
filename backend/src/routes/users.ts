import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { requireDirectoryAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { handles, profiles } from "../db/schema.js";
import { users } from "../db/social-schema.js";

export const usersRoutes = new Hono();

usersRoutes.get("/users/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const user = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.agentId, agentId) });
  const handle = await db.query.handles.findFirst({ where: eq(handles.agentId, agentId) });
  if (!user) {
    return c.json({
      agentId,
      displayName: profile?.displayName ?? agentId.slice(0, 8),
      email: undefined,
      emailVerified: true,
      username: handle?.name,
      metadata: {},
      updatedAt: new Date().toISOString(),
    });
  }
  return c.json({
    agentId,
    displayName: user.displayName ?? profile?.displayName,
    email: user.email,
    emailVerified: user.emailVerified,
    username: user.username ?? handle?.name,
    metadata: user.metadata ?? {},
    updatedAt: user.updatedAt.toISOString(),
  });
});

usersRoutes.put("/users/:agentId", requireDirectoryAuth, async (c) => {
  const agentId = c.req.param("agentId");
  const body = z
    .object({
      displayName: z.string().optional(),
      email: z.string().optional(),
      emailVerified: z.boolean().optional(),
      username: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .parse(await c.req.json());
  await db
    .insert(users)
    .values({
      agentId,
      displayName: body.displayName,
      email: body.email,
      emailVerified: body.emailVerified ?? false,
      username: body.username,
      metadata: body.metadata ?? {},
    })
    .onConflictDoUpdate({
      target: users.agentId,
      set: {
        displayName: body.displayName,
        email: body.email,
        emailVerified: body.emailVerified,
        username: body.username,
        metadata: body.metadata ?? {},
        updatedAt: new Date(),
      },
    });
  if (body.displayName) {
    await db
      .update(profiles)
      .set({ displayName: body.displayName, updatedAt: new Date() })
      .where(eq(profiles.agentId, agentId));
  }
  const user = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  return c.json({
    agentId,
    displayName: user!.displayName,
    email: user!.email,
    emailVerified: user!.emailVerified,
    username: user!.username,
    metadata: user!.metadata ?? {},
    updatedAt: user!.updatedAt.toISOString(),
  });
});
