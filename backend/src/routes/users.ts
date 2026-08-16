import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { requireDirectoryAuth } from "../auth/middleware.js";
import {
  allowsInitialUserWrite,
  hashVerificationCode,
  isEmailVerified,
  verificationCodeMatches,
} from "../auth/user-security.js";
import { db } from "../db/client.js";
import { agents, handles, profiles } from "../db/schema.js";
import { users } from "../db/social-schema.js";

export const usersRoutes = new Hono();

export function toUserResponse(
  agentId: string,
  user?: typeof users.$inferSelect | null,
  profile?: typeof profiles.$inferSelect | null,
  handle?: typeof handles.$inferSelect | null,
) {
  const metadata = (user?.metadata as Record<string, unknown>) ?? {};
  // Strip internal security metadata from public response
  const sanitizedMeta = { ...metadata };
  delete sanitizedMeta.emailVerification;

  return {
    cryptoId: agentId,
    agentId,
    actorType: (metadata.actorType as string) ?? "human",
    displayName: user?.displayName ?? profile?.displayName ?? agentId.slice(0, 8),
    bio: profile?.bio ?? "",
    avatarEmail: metadata.avatarEmail as string | undefined,
    email: user?.email ?? undefined,
    emailVerified: isEmailVerified(user?.emailVerified),
    emailVerifiedAt: isEmailVerified(user?.emailVerified) ? user?.updatedAt.toISOString() : undefined,
    emailVerificationRequestedAt: metadata.emailVerificationRequestedAt as string | undefined,
    username: user?.username ?? handle?.name,
    link: metadata.link as string | undefined,
    tags: (metadata.tags as Array<string>) ?? [],
    metadata: sanitizedMeta,
    createdAt: (user?.updatedAt ?? new Date()).toISOString(),
    updatedAt: (user?.updatedAt ?? new Date()).toISOString(),
  };
}

async function verifyUserOwnership(
  auth: { agentId: string; publicKeyBase64?: string },
  targetAgentId: string,
): Promise<boolean> {
  if (allowsInitialUserWrite(auth, targetAgentId)) {
    return true;
  }

  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, targetAgentId),
  });

  if (agent) {
    if (auth.publicKeyBase64 && agent.publicKeyBase64 === auth.publicKeyBase64) {
      return true;
    }
    if (agent.midnightAddress && agent.midnightAddress === auth.agentId) {
      return true;
    }
    return false;
  }

  return false;
}

async function ensureAgentRecord(agentId: string, publicKeyBase64?: string) {
  await db
    .insert(agents)
    .values({
      id: agentId,
      publicKeyBase64: publicKeyBase64 ?? agentId,
      midnightAddress: agentId.startsWith("00") || agentId.startsWith("mn_") ? agentId : undefined,
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
  const auth = c.get("auth");
  const isOwner = await verifyUserOwnership(auth, agentId);
  if (!isOwner) {
    return c.json({ error: "Forbidden: Cannot modify another user's profile", code: "FORBIDDEN" }, 403);
  }

  const body = z
    .object({
      displayName: z.string().optional(),
      email: z.string().optional(),
      username: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .parse(await c.req.json());

  await ensureAgentRecord(agentId, auth.publicKeyBase64);

  const existingUser = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  const currentMeta = (existingUser?.metadata as Record<string, unknown>) ?? {};
  const newMeta = { ...currentMeta, ...(body.metadata ?? {}) };

  await db
    .insert(users)
    .values({
      agentId,
      displayName: body.displayName,
      email: body.email,
      emailVerified: existingUser?.emailVerified ?? false,
      username: body.username,
      metadata: newMeta,
    })
    .onConflictDoUpdate({
      target: users.agentId,
      set: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.username !== undefined ? { username: body.username } : {}),
        metadata: newMeta,
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
  const auth = c.get("auth");
  const isOwner = await verifyUserOwnership(auth, agentId);
  if (!isOwner) {
    return c.json({ error: "Forbidden: Cannot modify another user's profile", code: "FORBIDDEN" }, 403);
  }

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

  await ensureAgentRecord(agentId, auth.publicKeyBase64);

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

async function sendVerificationEmail(toEmail: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "tiny.place <noreply@tiny.place>",
        to: [toEmail],
        subject: "Your tiny.place verification code",
        text: `Your verification code is: ${code}\n\nThis code expires in 15 minutes.`,
      }),
    });
  } catch (err) {
    console.error("Failed to send verification email via Resend:", err);
  }
}

usersRoutes.post("/users/:agentId/email/verification", requireDirectoryAuth, async (c) => {
  const agentId = c.req.param("agentId");
  const auth = c.get("auth");
  const isOwner = await verifyUserOwnership(auth, agentId);
  if (!isOwner) {
    return c.json({ error: "Forbidden: Cannot start verification for another user", code: "FORBIDDEN" }, 403);
  }

  const body = z
    .object({
      email: z.string().email(),
      harnessKey: z.string().optional(),
      signature: z.string().optional(),
    })
    .parse(await c.req.json());

  await ensureAgentRecord(agentId, auth.publicKeyBase64);

  const email = body.email.toLowerCase().trim();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = hashVerificationCode(email, code);
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  await sendVerificationEmail(email, code);

  const existingUser = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  const currentMeta = (existingUser?.metadata as Record<string, unknown>) ?? {};

  const updatedMeta: Record<string, unknown> = {
    ...currentMeta,
    emailVerificationRequestedAt: new Date().toISOString(),
    emailVerification: {
      codeHash,
      email,
      expiresAt,
      attempts: 0,
      requestedAt: new Date().toISOString(),
    },
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
  const auth = c.get("auth");
  const isOwner = await verifyUserOwnership(auth, agentId);
  if (!isOwner) {
    return c.json({ error: "Forbidden: Cannot confirm verification for another user", code: "FORBIDDEN" }, 403);
  }

  const body = z
    .object({
      email: z.string().email(),
      code: z.string(),
      harnessKey: z.string().optional(),
      signature: z.string().optional(),
    })
    .parse(await c.req.json());

  const email = body.email.toLowerCase().trim();
  const existingUser = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  const currentMeta = (existingUser?.metadata as Record<string, unknown>) ?? {};
  const emailVerif = currentMeta.emailVerification as
    | { codeHash: string; email: string; expiresAt: number; attempts: number }
    | undefined;

  if (!emailVerif || emailVerif.email !== email || Date.now() > emailVerif.expiresAt) {
    return c.json({ error: "Verification code expired or not requested", code: "CODE_EXPIRED" }, 400);
  }

  if (emailVerif.attempts >= 5) {
    return c.json({ error: "Too many failed attempts. Please request a new code.", code: "TOO_MANY_ATTEMPTS" }, 429);
  }

  const codeMatches = verificationCodeMatches(email, emailVerif.codeHash, body.code);

  if (!codeMatches) {
    const updatedMeta = {
      ...currentMeta,
      emailVerification: {
        ...emailVerif,
        attempts: emailVerif.attempts + 1,
      },
    };
    await db.update(users).set({ metadata: updatedMeta }).where(eq(users.agentId, agentId));
    return c.json({ error: "Invalid verification code", code: "INVALID_CODE" }, 400);
  }

  await ensureAgentRecord(agentId, auth.publicKeyBase64);

  const updatedMeta = { ...currentMeta };
  delete updatedMeta.emailVerification;

  await db
    .insert(users)
    .values({
      agentId,
      email,
      emailVerified: true,
      metadata: updatedMeta,
    })
    .onConflictDoUpdate({
      target: users.agentId,
      set: {
        email,
        emailVerified: true,
        metadata: updatedMeta,
        updatedAt: new Date(),
      },
    });

  const user = await db.query.users.findFirst({ where: eq(users.agentId, agentId) });
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.agentId, agentId) });
  const handle = await db.query.handles.findFirst({ where: eq(handles.agentId, agentId) });
  return c.json(toUserResponse(agentId, user, profile, handle));
});
