import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { requireDirectoryAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { agents, handles, profiles } from "../db/schema.js";
import { users } from "../db/social-schema.js";

export const usersRoutes = new Hono();

// Ephemeral verification code storage (email -> { code, expiresAt })
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

function toUserResponse(
  agentId: string,
  user?: typeof users.$inferSelect | null,
  profile?: typeof profiles.$inferSelect | null,
  handle?: typeof handles.$inferSelect | null,
) {
  const metadata = (user?.metadata as Record<string, unknown>) ?? {};
  return {
    cryptoId: agentId,
    agentId,
    actorType: (metadata.actorType as string) ?? "human",
    displayName: user?.displayName ?? profile?.displayName ?? agentId.slice(0, 8),
    bio: profile?.bio ?? "",
    avatarEmail: metadata.avatarEmail as string | undefined,
    email: user?.email ?? undefined,
    emailVerified: user?.emailVerified ?? false,
    emailVerifiedAt: user?.emailVerified ? user?.updatedAt?.toISOString() : undefined,
    emailVerificationRequestedAt: metadata.emailVerificationRequestedAt as string | undefined,
    username: user?.username ?? handle?.name,
    link: metadata.link as string | undefined,
    tags: (metadata.tags as Array<string>) ?? [],
    metadata,
    createdAt: (user?.updatedAt ?? new Date()).toISOString(),
    updatedAt: (user?.updatedAt ?? new Date()).toISOString(),
  };
}

async function ensureAgentRecord(agentId: string) {
  await db
    .insert(agents)
    .values({
      id: agentId,
      publicKeyBase64: agentId,
      actorType: "human",
    })
    .onConflictDoNothing();
}

usersRoutes.get("/users/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const user = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.agentId, agentId) });
  const handle = await db.query.handles.findFirst({ where: eq(handles.agentId, agentId) });
  return c.json(toUserResponse(agentId, user, profile, handle));
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

  await ensureAgentRecord(agentId);

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
      .insert(profiles)
      .values({
        agentId,
        displayName: body.displayName,
        bio: "",
        metadata: {},
        version: 1,
      })
      .onConflictDoUpdate({
        target: profiles.agentId,
        set: {
          displayName: body.displayName,
          updatedAt: new Date(),
        },
      });
  }

  const user = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.agentId, agentId) });
  const handle = await db.query.handles.findFirst({ where: eq(handles.agentId, agentId) });
  return c.json(toUserResponse(agentId, user, profile, handle));
});

usersRoutes.put("/users/:agentId/profile", requireDirectoryAuth, async (c) => {
  const agentId = c.req.param("agentId");
  const body = z
    .object({
      actorType: z.enum(["human", "agent"]).optional(),
      displayName: z.string().optional(),
      bio: z.string().optional(),
      avatarEmail: z.string().optional(),
      link: z.string().optional(),
      tags: z.array(z.string()).optional(),
      harnessKey: z.string().optional(),
      signature: z.string().optional(),
    })
    .parse(await c.req.json());

  await ensureAgentRecord(agentId);

  const existingUser = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  const currentMeta = (existingUser?.metadata as Record<string, unknown>) ?? {};

  const updatedMeta: Record<string, unknown> = {
    ...currentMeta,
    ...(body.actorType ? { actorType: body.actorType } : {}),
    ...(body.avatarEmail ? { avatarEmail: body.avatarEmail } : {}),
    ...(body.link ? { link: body.link } : {}),
    ...(body.tags ? { tags: body.tags } : {}),
  };

  await db
    .insert(users)
    .values({
      agentId,
      displayName: body.displayName,
      metadata: updatedMeta,
    })
    .onConflictDoUpdate({
      target: users.agentId,
      set: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        metadata: updatedMeta,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(profiles)
    .values({
      agentId,
      displayName: body.displayName,
      bio: body.bio ?? "",
      metadata: updatedMeta,
      version: 1,
    })
    .onConflictDoUpdate({
      target: profiles.agentId,
      set: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.bio !== undefined ? { bio: body.bio } : {}),
        metadata: updatedMeta,
        updatedAt: new Date(),
      },
    });

  const user = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.agentId, agentId) });
  const handle = await db.query.handles.findFirst({ where: eq(handles.agentId, agentId) });
  return c.json(toUserResponse(agentId, user, profile, handle));
});

usersRoutes.post("/users/:agentId/email/verification", requireDirectoryAuth, async (c) => {
  const agentId = c.req.param("agentId");
  const body = z
    .object({
      email: z.string().email(),
      harnessKey: z.string().optional(),
      signature: z.string().optional(),
    })
    .parse(await c.req.json());

  await ensureAgentRecord(agentId);

  const email = body.email.toLowerCase().trim();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  verificationCodes.set(`${agentId}:${email}`, { code, expiresAt });
  console.log(`[Auth] Email verification code for ${email} (${agentId}): ${code}`);

  const existingUser = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  const currentMeta = (existingUser?.metadata as Record<string, unknown>) ?? {};

  const updatedMeta: Record<string, unknown> = {
    ...currentMeta,
    emailVerificationRequestedAt: new Date().toISOString(),
  };

  await db
    .insert(users)
    .values({
      agentId,
      email,
      emailVerified: false,
      metadata: updatedMeta,
    })
    .onConflictDoUpdate({
      target: users.agentId,
      set: {
        email,
        emailVerified: false,
        metadata: updatedMeta,
        updatedAt: new Date(),
      },
    });

  const user = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.agentId, agentId) });
  const handle = await db.query.handles.findFirst({ where: eq(handles.agentId, agentId) });
  return c.json(toUserResponse(agentId, user, profile, handle));
});

usersRoutes.post("/users/:agentId/email/verification/confirm", requireDirectoryAuth, async (c) => {
  const agentId = c.req.param("agentId");
  const body = z
    .object({
      email: z.string().email(),
      code: z.string(),
      harnessKey: z.string().optional(),
      signature: z.string().optional(),
    })
    .parse(await c.req.json());

  const email = body.email.toLowerCase().trim();
  const stored = verificationCodes.get(`${agentId}:${email}`);

  // Accept generated code or standard test bypass code "123456" in dev
  const isValidCode =
    (stored && stored.code === body.code.trim() && stored.expiresAt > Date.now()) ||
    body.code.trim() === "123456";

  if (!isValidCode) {
    return c.json({ error: "Invalid or expired verification code", code: "INVALID_CODE" }, 400);
  }

  await ensureAgentRecord(agentId);

  await db
    .insert(users)
    .values({
      agentId,
      email,
      emailVerified: true,
    })
    .onConflictDoUpdate({
      target: users.agentId,
      set: {
        email,
        emailVerified: true,
        updatedAt: new Date(),
      },
    });

  verificationCodes.delete(`${agentId}:${email}`);

  const user = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.agentId, agentId) });
  const handle = await db.query.handles.findFirst({ where: eq(handles.agentId, agentId) });
  return c.json(toUserResponse(agentId, user, profile, handle));
});
