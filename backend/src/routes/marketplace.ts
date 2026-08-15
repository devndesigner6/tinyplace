import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";

import { hashCommitment } from "../auth/crypto.js";
import { requireDirectoryAuth } from "../auth/middleware.js";
import { enforceSignedIntent, type SignedTransactionIntent } from "../auth/signed-intent.js";
import { db } from "../db/client.js";
import {
  jobs,
  listingVersions,
  listings,
} from "../db/schema.js";
import { createChainJob } from "../services/chain-jobs.js";
import type { MidnightProvider } from "../services/midnight/provider.js";

export function marketplaceRoutes(midnight: MidnightProvider) {
  const app = new Hono();

  app.get("/marketplace/products", async (c) => {
    const rows = await db.select().from(listings).limit(50);
    return c.json({
      products: rows.map((row) => ({
        productId: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        price: {
          amount: row.priceAmount,
          asset: row.priceAsset,
          network: row.priceNetwork,
        },
        sellerAgentId: row.sellerAgentId,
        active: row.active,
      })),
    });
  });

  app.get("/marketplace/products/:productId", async (c) => {
    const row = await db.query.listings.findFirst({
      where: eq(listings.id, c.req.param("productId")),
    });
    if (!row) return c.json({ error: "Product not found" }, 404);
    const versions = await db
      .select()
      .from(listingVersions)
      .where(eq(listingVersions.listingId, row.id))
      .orderBy(desc(listingVersions.version));
    return c.json({
      productId: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      price: {
        amount: row.priceAmount,
        asset: row.priceAsset,
        network: row.priceNetwork,
      },
      sellerAgentId: row.sellerAgentId,
      versions: versions.map((v) => ({
        versionId: v.id,
        version: v.version,
        contentHash: v.contentHash,
        chainAnchored: v.chainAnchored,
        chainCommitmentTx: v.chainCommitmentTx,
      })),
    });
  });

  app.post("/marketplace/products", requireDirectoryAuth, async (c) => {
    const body = z
      .object({
        listingId: z.string().optional(),
        title: z.string(),
        description: z.string(),
        category: z.string().optional(),
        priceAmount: z.string(),
        priceAsset: z.string().default("NIGHT"),
        priceNetwork: z.string().default("midnight:preprod"),
        signedIntent: z.custom<SignedTransactionIntent>().optional(),
      })
      .parse(await c.req.json());
    const sellerAgentId = c.get("auth").agentId;
    const listingId = body.listingId ?? `lst_${nanoid(10)}`;

    const intentCheck = await enforceSignedIntent(body.signedIntent, {
      actor: sellerAgentId,
      action: "anchor_listing",
      contractAddress: midnight.contractAddresses().listingRegistry,
      network: body.priceNetwork,
      resourceId: listingId,
      amount: body.priceAmount,
      asset: body.priceAsset,
    }, { required: true });

    if (!intentCheck.ok) {
      return c.json({ error: intentCheck.error, code: "INVALID_SIGNED_INTENT" }, (intentCheck.status as any) ?? 401);
    }
    await db.insert(listings).values({
      id: listingId,
      sellerAgentId,
      title: body.title,
      description: body.description,
      category: body.category,
      priceAmount: body.priceAmount,
      priceAsset: body.priceAsset,
      priceNetwork: body.priceNetwork,
    });
    const snapshot = {
      title: body.title,
      description: body.description,
      category: body.category,
      priceAmount: body.priceAmount,
      priceAsset: body.priceAsset,
      priceNetwork: body.priceNetwork,
    };
    const contentHash = hashCommitment(snapshot);
    const versionId = `lv_${nanoid(10)}`;
    const chainJob = await createChainJob(
      {
        kind: "listing_anchor",
        agentId: sellerAgentId,
        resourceType: "listing",
        resourceId: listingId,
        payload: { listingId, contentHash, version: 1 },
        idempotencyKey: `listing_anchor:${listingId}:1`,
      },
      midnight,
    );
    await db.insert(listingVersions).values({
      id: versionId,
      listingId,
      version: 1,
      contentHash,
      chainAnchored: chainJob.status === "finalized",
      chainCommitmentTx: chainJob.status === "finalized" ? chainJob.txHash : undefined,
      snapshot,
    });
    return c.json({
      productId: listingId,
      versionId,
      contentHash,
      chainJob,
    });
  });

  app.post("/marketplace/products/:productId/jobs", requireDirectoryAuth, async (c) => {
    const productId = c.req.param("productId");
    const body = z
      .object({
        listingVersionId: z.string().optional(),
        deadline: z.string().optional(),
        privacyRequirements: z.record(z.unknown()).optional(),
      })
      .parse(await c.req.json());

    const listing = await db.query.listings.findFirst({
      where: eq(listings.id, productId),
    });
    if (!listing) return c.json({ error: "Product not found" }, 404);

    const version =
      body.listingVersionId
        ? await db.query.listingVersions.findFirst({
            where: eq(listingVersions.id, body.listingVersionId),
          })
        : await db.query.listingVersions.findFirst({
            where: eq(listingVersions.listingId, productId),
          });
    if (!version) return c.json({ error: "Listing version not found" }, 404);

    const buyerAgentId = c.get("auth").agentId;
    const jobId = `job_${nanoid(10)}`;
    const jobCommitment = hashCommitment({
      jobId,
      listingVersionId: version.id,
      contentHash: version.contentHash,
      buyerAgentId,
      sellerAgentId: listing.sellerAgentId,
      amount: listing.priceAmount,
      asset: listing.priceAsset,
    });

    await db.insert(jobs).values({
      id: jobId,
      listingVersionId: version.id,
      buyerAgentId,
      sellerAgentId: listing.sellerAgentId,
      status: "awaiting_fund",
      jobCommitment,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
      privacyRequirements: body.privacyRequirements ?? {},
    });

    return c.json({
      jobId,
      listingVersionId: version.id,
      listingVersionHash: version.contentHash,
      jobCommitment,
      status: "awaiting_fund",
      sellerAgentId: listing.sellerAgentId,
      buyerAgentId,
      price: {
        amount: listing.priceAmount,
        asset: listing.priceAsset,
        network: listing.priceNetwork,
      },
    });
  });

  app.post("/jobs/:jobId/accept", requireDirectoryAuth, async (c) => {
    const jobId = c.req.param("jobId");
    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
    if (!job) return c.json({ error: "Job not found" }, 404);
    if (c.get("auth").agentId !== job.sellerAgentId) {
      return c.json({ error: "Only seller may accept" }, 403);
    }
    await db
      .update(jobs)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(jobs.id, jobId));
    return c.json({ jobId, status: "in_progress" });
  });

  app.post("/jobs/:jobId/artifacts", requireDirectoryAuth, async (c) => {
    const jobId = c.req.param("jobId");
    const body = z
      .object({
        direction: z.enum(["input", "output"]),
        ciphertextBase64: z.string(),
        mimeType: z.string().optional(),
      })
      .parse(await c.req.json());
    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
    if (!job) return c.json({ error: "Job not found" }, 404);

    const { storeEncryptedArtifact } = await import("../services/artifacts.js");
    const stored = await storeEncryptedArtifact({
      jobId,
      uploaderAgentId: c.get("auth").agentId,
      direction: body.direction,
      ciphertext: Buffer.from(body.ciphertextBase64, "base64"),
      mimeType: body.mimeType,
    });

    const { artifacts: artifactsTable } = await import("../db/schema.js");
    const artifactId = `art_${nanoid(10)}`;
    await db.insert(artifactsTable).values({
      id: artifactId,
      jobId,
      escrowId: job.escrowId,
      uploaderAgentId: c.get("auth").agentId,
      direction: body.direction,
      contentHash: stored.contentHash,
      storageKey: stored.storageKey,
      mimeType: body.mimeType,
      sizeBytes: stored.sizeBytes,
      encrypted: true,
    });

    return c.json({
      artifactId,
      contentHash: stored.contentHash,
      direction: body.direction,
    });
  });

  return app;
}
