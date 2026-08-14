import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";

import { hashCommitment, isReservedHandle, isValidHandleLabel, normalizeHandle } from "../auth/crypto.js";
import { requireDirectoryAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { agents, handles, profiles } from "../db/schema.js";
import { createChainJob } from "../services/chain-jobs.js";
import { hackathonDevFallbackEnabled } from "../services/hackathon-dev.js";
import type { MidnightProvider } from "../services/midnight/provider.js";

const registerSchema = z.object({
  username: z.string(),
  cryptoId: z.string(),
  publicKey: z.string().optional(),
  bio: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  actorType: z.enum(["human", "agent"]).optional(),
  primary: z.boolean().optional(),
  midnightAddress: z.string().optional(),
  midnightTxHash: z.string().optional(),
});

export function registryRoutes(midnight: MidnightProvider) {
  const app = new Hono();

  app.get("/registry/names/:name", async (c) => {
    const name = normalizeHandle(c.req.param("name"));
    const record = await db.query.handles.findFirst({
      where: eq(handles.name, name),
      with: undefined,
    });
    if (!record) {
      return c.json({
        available: !isReservedHandle(name) && isValidHandleLabel(name),
        username: name,
      });
    }
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.agentId, record.agentId),
    });
    return c.json({
      available: false,
      username: record.name,
      cryptoId: record.agentId,
      bio: profile?.bio ?? "",
      status: record.status,
      registeredAt: record.registeredAt?.toISOString(),
      expiresAt: record.expiresAt?.toISOString(),
      registrationTx: record.chainTxHash,
      metadata: profile?.metadata ?? {},
      midnight: {
        ownerCommitment: record.ownerCommitment,
        profileVersionHash: record.profileVersionHash,
        contractAddress: record.contractAddress,
        verified: record.status === "active",
      },
    });
  });

  app.post("/registry/names", requireDirectoryAuth, async (c) => {
    const body = registerSchema.parse(await c.req.json());
    const name = normalizeHandle(body.username);
    if (!isValidHandleLabel(name) || isReservedHandle(name)) {
      return c.json({ error: "Invalid or reserved handle", code: "INVALID_HANDLE" }, 400);
    }
    const existing = await db.query.handles.findFirst({
      where: eq(handles.name, name),
    });
    if (existing && existing.status === "active") {
      return c.json({ error: "Handle taken", code: "HANDLE_TAKEN" }, 409);
    }

    const agentId = body.cryptoId;
    await db
      .insert(agents)
      .values({
        id: agentId,
        publicKeyBase64: body.publicKey ?? agentId,
        midnightAddress: body.midnightAddress,
        actorType: body.actorType ?? "agent",
      })
      .onConflictDoUpdate({
        target: agents.id,
        set: {
          midnightAddress: body.midnightAddress,
          updatedAt: new Date(),
        },
      });

    const profileVersionHash = hashCommitment({
      bio: body.bio ?? "",
      metadata: body.metadata ?? {},
    });
    const ownerCommitment = hashCommitment({
      agentId,
      midnightAddress: body.midnightAddress ?? agentId,
    });

    const handleId = existing?.id ?? nanoid();
    await db
      .insert(handles)
      .values({
        id: handleId,
        name,
        agentId,
        status: body.midnightTxHash ? "active" : "pending_chain",
        profileVersionHash,
        ownerCommitment,
        chainTxHash: body.midnightTxHash,
        contractAddress: midnight.contractAddresses().handleRegistry,
        registeredAt: body.midnightTxHash ? new Date() : undefined,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60_000),
      })
      .onConflictDoUpdate({
        target: handles.id,
        set: {
          profileVersionHash,
          ownerCommitment,
          status: body.midnightTxHash ? "active" : "pending_chain",
          chainTxHash: body.midnightTxHash,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(profiles)
      .values({
        agentId,
        bio: body.bio ?? "",
        metadata: body.metadata ?? {},
      })
      .onConflictDoUpdate({
        target: profiles.agentId,
        set: {
          bio: body.bio ?? "",
          metadata: body.metadata ?? {},
          version: 1,
          updatedAt: new Date(),
        },
      });

    if (!body.midnightTxHash) {
      const chainJob = await createChainJob(
        {
          kind: "handle_claim",
          agentId,
          resourceType: "handle",
          resourceId: name,
          payload: { handle: name, ownerCommitment, profileVersionHash },
          idempotencyKey: `handle_claim:${name}`,
        },
        midnight,
      );
      const refreshed = await db.query.handles.findFirst({ where: eq(handles.name, name) });
      if (chainJob.status === "finalized" && refreshed?.status === "active") {
        return c.json({
          username: name,
          cryptoId: agentId,
          status: "active",
          registrationTx: refreshed.chainTxHash,
          profileVersionHash,
          ownerCommitment,
          chainJob,
        });
      }
      if (hackathonDevFallbackEnabled(midnight)) {
        await db
          .update(handles)
          .set({
            status: "active",
            registeredAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(handles.name, name));
        return c.json({
          username: name,
          cryptoId: agentId,
          status: "active",
          devMode: true,
          profileVersionHash,
          ownerCommitment,
          chainJob,
          note: "Handle activated in hackathon dev mode (Midnight contracts not deployed).",
        });
      }
      const challenge = await midnight.buildClaimHandleChallenge({
        handle: name,
        ownerCommitment,
        profileVersionHash,
      });
      return c.json(
        {
          status: "payment-required",
          error: "Midnight handle claim required",
          payment: challenge,
          chainJob,
          username: name,
          cryptoId: agentId,
        },
        402,
      );
    }

    return c.json({
      username: name,
      cryptoId: agentId,
      status: "active",
      registrationTx: body.midnightTxHash,
      profileVersionHash,
      ownerCommitment,
    });
  });

  app.put("/registry/names/:name/profile", requireDirectoryAuth, async (c) => {
    const name = normalizeHandle(c.req.param("name"));
    const record = await db.query.handles.findFirst({
      where: eq(handles.name, name),
    });
    if (!record) return c.json({ error: "Handle not found" }, 404);
    const body = z
      .object({
        bio: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
      .parse(await c.req.json());
    const profileVersionHash = hashCommitment({
      bio: body.bio ?? "",
      metadata: body.metadata ?? {},
    });
    await db
      .update(profiles)
      .set({
        bio: body.bio,
        metadata: body.metadata ?? {},
        version: (record.profileVersionHash ? 2 : 1),
        updatedAt: new Date(),
      })
      .where(eq(profiles.agentId, record.agentId));
    await db
      .update(handles)
      .set({ profileVersionHash, updatedAt: new Date() })
      .where(eq(handles.id, record.id));
    return c.json({ username: name, profileVersionHash, updated: true });
  });

  return app;
}
