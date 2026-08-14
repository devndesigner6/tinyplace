import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db/client.js";
import { keyBundles } from "../db/schema.js";

export const keysRoutes = new Hono();

keysRoutes.get("/keys/:agentId/bundle", async (c) => {
  const agentId = c.req.param("agentId");
  const bundle = await db.query.keyBundles.findFirst({
    where: eq(keyBundles.agentId, agentId),
  });
  if (!bundle) return c.json({ error: "Key bundle not found" }, 404);
  return c.json({
    identityKey: bundle.identityKey,
    signedPreKey: bundle.signedPreKey,
    oneTimePreKeys: bundle.oneTimePreKeys,
  });
});

keysRoutes.put("/keys/:agentId/prekeys", async (c) => {
  const agentId = c.req.param("agentId");
  const body = z
    .object({
      identityKey: z.string(),
      signedPreKey: z.record(z.unknown()),
      oneTimePreKeys: z.array(z.record(z.unknown())),
    })
    .parse(await c.req.json());
  await db
    .insert(keyBundles)
    .values({
      agentId,
      identityKey: body.identityKey,
      signedPreKey: body.signedPreKey,
      oneTimePreKeys: body.oneTimePreKeys,
    })
    .onConflictDoUpdate({
      target: keyBundles.agentId,
      set: {
        identityKey: body.identityKey,
        signedPreKey: body.signedPreKey,
        oneTimePreKeys: body.oneTimePreKeys,
        updatedAt: new Date(),
      },
    });
  return c.json({ agentId, uploaded: true });
});

keysRoutes.put("/keys/:agentId/signed-prekey", async (c) => {
  const agentId = c.req.param("agentId");
  const body = z.object({ signedPreKey: z.record(z.unknown()) }).parse(await c.req.json());
  const bundle = await db.query.keyBundles.findFirst({
    where: eq(keyBundles.agentId, agentId),
  });
  if (!bundle) return c.json({ error: "Key bundle not found" }, 404);
  await db
    .update(keyBundles)
    .set({ signedPreKey: body.signedPreKey, updatedAt: new Date() })
    .where(eq(keyBundles.agentId, agentId));
  return c.json({ agentId, rotated: true });
});
