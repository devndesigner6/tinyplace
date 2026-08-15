import { eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";

import { hashCommitment } from "../auth/crypto.js";
import { requireDirectoryAuth } from "../auth/middleware.js";
import { enforceSignedIntent, type SignedTransactionIntent } from "../auth/signed-intent.js";
import { db } from "../db/client.js";
import { escrows, jobs, ledgerEntries, reputationEvents } from "../db/schema.js";
import { createChainJob } from "../services/chain-jobs.js";
import {
  assertParty,
  nextStatus,
  type EscrowAction,
  type EscrowFsmStatus,
} from "../services/escrow-state.js";
import { storeEncryptedArtifact } from "../services/artifacts.js";
import type { MidnightProvider } from "../services/midnight/provider.js";
import { createInboxItem } from "./inbox.js";

function toApiEscrow(row: typeof escrows.$inferSelect) {
  return {
    escrowId: row.escrowId,
    status: row.status,
    client: row.client,
    clientCryptoId: row.clientCryptoId,
    provider: row.provider,
    providerCryptoId: row.providerCryptoId,
    amount: row.amount,
    asset: row.asset,
    network: row.network,
    terms: row.terms,
    revisionCount: row.revisionCount,
    deliveries: row.deliveries ?? [],
    dispute: row.dispute,
    createdAt: row.createdAt.toISOString(),
    fundedAt: row.fundedAt?.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString(),
    deliveredAt: row.deliveredAt?.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString(),
    onChainTx: row.onChainTx,
    contractAddress: row.contractAddress,
    contractEscrowId: row.contractEscrowId,
    listingVersionHash: row.listingVersionHash,
    jobCommitment: row.jobCommitment,
    chainAuthoritative: row.chainAuthoritative,
    midnight: {
      contractAddress: row.contractAddress,
      contractEscrowId: row.contractEscrowId,
      listingVersionHash: row.listingVersionHash,
      jobCommitment: row.jobCommitment,
      chainAuthoritative: row.chainAuthoritative,
    },
  };
}

async function applyEscrowTransition(
  escrowId: string,
  event: EscrowAction,
  extra: Partial<typeof escrows.$inferInsert> = {},
) {
  const row = await db.query.escrows.findFirst({
    where: eq(escrows.escrowId, escrowId),
  });
  if (!row) throw new Error("Escrow not found");
  const from = row.status as EscrowFsmStatus;
  const to = nextStatus(from, event);
  await db
    .update(escrows)
    .set({
      status: to,
      updatedAt: new Date(),
      ...extra,
    })
    .where(eq(escrows.escrowId, escrowId));
  return to;
}

function orActorEscrow(actor: string, client?: string, provider?: string) {
  if (client && provider) {
    return or(
      eq(escrows.client, client),
      eq(escrows.provider, provider),
      eq(escrows.clientCryptoId, client),
      eq(escrows.providerCryptoId, provider),
    );
  }
  return or(
    eq(escrows.client, actor),
    eq(escrows.provider, actor),
    eq(escrows.clientCryptoId, actor),
    eq(escrows.providerCryptoId, actor),
  );
}

export function escrowRoutes(midnight: MidnightProvider) {
  const app = new Hono();

  app.get("/escrow", requireDirectoryAuth, async (c) => {
    const actor = c.get("auth").agentId;
    const rows = await db.query.escrows.findMany({
      where: orActorEscrow(actor, c.req.query("client"), c.req.query("provider")),
    });
    return c.json({ escrows: rows.map(toApiEscrow) });
  });

  app.get("/escrow/active", requireDirectoryAuth, async (c) => {
    const actor = c.get("auth").agentId;
    const rows = await db
      .select()
      .from(escrows)
      .where(
        orActorEscrow(actor, c.req.query("client"), c.req.query("provider")),
      );
    return c.json({ escrows: rows.map(toApiEscrow) });
  });

  app.get("/escrow/:escrowId", requireDirectoryAuth, async (c) => {
    const row = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, c.req.param("escrowId")),
    });
    if (!row) return c.json({ error: "Escrow not found" }, 404);
    return c.json(toApiEscrow(row));
  });

  app.post("/escrow", requireDirectoryAuth, async (c) => {
    const body = z
      .object({
        escrowId: z.string().optional(),
        client: z.string(),
        clientCryptoId: z.string().optional(),
        provider: z.string(),
        providerCryptoId: z.string().optional(),
        amount: z.string(),
        asset: z.string(),
        network: z.string().default("midnight:preprod"),
        terms: z.record(z.unknown()),
        jobId: z.string().optional(),
        listingVersionHash: z.string().optional(),
        jobCommitment: z.string().optional(),
        signedIntent: z.custom<SignedTransactionIntent>().optional(),
      })
      .parse(await c.req.json());

    const escrowId = body.escrowId ?? `esc_${nanoid(12)}`;

    if (body.signedIntent) {
      const intentCheck = await enforceSignedIntent(body.signedIntent, {
        actor: c.get("auth").agentId,
        action: "create_escrow",
        resourceId: escrowId,
        amount: body.amount,
        asset: body.asset,
      });
      if (!intentCheck.ok) {
        return c.json({ error: intentCheck.error, code: "INVALID_SIGNED_INTENT" }, (intentCheck.status as any) ?? 403);
      }
    }

    await db.insert(escrows).values({
      escrowId,
      jobId: body.jobId,
      status: "created",
      client: body.client,
      clientCryptoId: body.clientCryptoId,
      provider: body.provider,
      providerCryptoId: body.providerCryptoId,
      amount: body.amount,
      asset: body.asset,
      network: body.network,
      terms: body.terms,
      listingVersionHash: body.listingVersionHash,
      jobCommitment: body.jobCommitment,
      contractAddress: midnight.contractAddresses().escrow,
      contractEscrowId: escrowId,
      chainAuthoritative: true,
    });

    if (body.jobId) {
      await db
        .update(jobs)
        .set({ escrowId, status: "awaiting_fund", updatedAt: new Date() })
        .where(eq(jobs.id, body.jobId));
    }

    const row = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    return c.json(toApiEscrow(row!));
  });

  app.post("/escrow/:escrowId/fund-intent", requireDirectoryAuth, async (c) => {
    const escrowId = c.req.param("escrowId");
    const row = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    if (!row) return c.json({ error: "Escrow not found" }, 404);
    assertParty("client", c.get("auth").agentId, row.client, row.provider);
    const challenge = await midnight.buildFundChallenge({
      escrowId,
      amount: row.amount,
      asset: row.asset,
      buyerMidnightAddress: c.get("auth").agentId,
      jobCommitment: row.jobCommitment ?? hashCommitment({ escrowId }),
    });
    await applyEscrowTransition(escrowId, "prepare_fund");
    return c.json({ escrowId, status: "pending_fund", payment: challenge });
  });

  app.post("/escrow/:escrowId/fund", requireDirectoryAuth, async (c) => {
    const escrowId = c.req.param("escrowId");
    const body = z
      .object({
        midnightTxHash: z.string(),
        idempotencyKey: z.string().optional(),
        signedIntent: z.custom<SignedTransactionIntent>().optional(),
      })
      .parse(await c.req.json());
    const row = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    if (!row) return c.json({ error: "Escrow not found" }, 404);
    assertParty("client", c.get("auth").agentId, row.client, row.provider);

    if (body.signedIntent) {
      const intentCheck = await enforceSignedIntent(body.signedIntent, {
        actor: c.get("auth").agentId,
        action: "fund_escrow",
        resourceId: escrowId,
        amount: row.amount,
        asset: row.asset,
      });
      if (!intentCheck.ok) {
        return c.json({ error: intentCheck.error, code: "INVALID_SIGNED_INTENT" }, (intentCheck.status as any) ?? 403);
      }
    }

    const chainJob = await createChainJob(
      {
        kind: "escrow_fund",
        agentId: row.client,
        resourceType: "escrow",
        resourceId: escrowId,
        payload: { escrowId, txHash: body.midnightTxHash },
        idempotencyKey: body.idempotencyKey ?? `escrow_fund:${escrowId}`,
        submittedTxHash: body.midnightTxHash,
      },
      midnight,
    );

    if (chainJob.status !== "finalized") {
      return c.json({ escrowId, chainJob, status: "submitted" }, 202);
    }

    await applyEscrowTransition(escrowId, "confirm_fund", {
      onChainTx: body.midnightTxHash,
      fundedAt: new Date(),
    });
    if (row.jobId) {
      await db
        .update(jobs)
        .set({ status: "open", updatedAt: new Date() })
        .where(eq(jobs.id, row.jobId));
    }
    await db.insert(ledgerEntries).values({
      id: nanoid(),
      kind: "escrow_fund",
      fromAgentId: row.client,
      toAgentId: row.provider,
      amount: row.amount,
      asset: row.asset,
      network: row.network,
      txHash: body.midnightTxHash,
      resourceType: "escrow",
      resourceId: escrowId,
    });
    const updated = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    return c.json({ ...toApiEscrow(updated!), chainJob });
  });

  app.post("/escrow/:escrowId/accept", requireDirectoryAuth, async (c) => {
    const escrowId = c.req.param("escrowId");
    const row = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    if (!row) return c.json({ error: "Escrow not found" }, 404);
    assertParty("provider", c.get("auth").agentId, row.client, row.provider);
    await applyEscrowTransition(escrowId, "accept", {
      acceptedAt: new Date(),
    });
    if (row.jobId) {
      await db
        .update(jobs)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(jobs.id, row.jobId));
    }
    const updated = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    return c.json(toApiEscrow(updated!));
  });

  app.post("/escrow/:escrowId/deliver", requireDirectoryAuth, async (c) => {
    const escrowId = c.req.param("escrowId");
    const body = z
      .object({
        description: z.string(),
        refs: z.array(z.string()).optional(),
        outputCiphertextBase64: z.string().optional(),
        outputHash: z.string().optional(),
        signedIntent: z.custom<SignedTransactionIntent>().optional(),
      })
      .parse(await c.req.json());
    const row = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    if (!row) return c.json({ error: "Escrow not found" }, 404);
    assertParty("provider", c.get("auth").agentId, row.client, row.provider);

    if (body.signedIntent) {
      const intentCheck = await enforceSignedIntent(body.signedIntent, {
        actor: c.get("auth").agentId,
        action: "deliver_escrow",
        resourceId: escrowId,
      });
      if (!intentCheck.ok) {
        return c.json({ error: intentCheck.error, code: "INVALID_SIGNED_INTENT" }, (intentCheck.status as any) ?? 403);
      }
    }

    let outputHash = body.outputHash;
    if (body.outputCiphertextBase64) {
      const stored = await storeEncryptedArtifact({
        escrowId,
        jobId: row.jobId ?? undefined,
        uploaderAgentId: row.provider,
        direction: "output",
        ciphertext: Buffer.from(body.outputCiphertextBase64, "base64"),
      });
      outputHash = stored.contentHash;
    }
    outputHash ??= hashCommitment({ description: body.description, refs: body.refs });

    const chainJob = await createChainJob(
      {
        kind: "escrow_deliver",
        agentId: row.provider,
        resourceType: "escrow",
        resourceId: escrowId,
        payload: {
          escrowId,
          outputHash,
          callerCommitment: row.providerCryptoId ?? row.provider,
          sellerCommitment: row.providerCryptoId ?? row.provider,
        },
        idempotencyKey: `escrow_deliver:${escrowId}:${row.revisionCount}`,
      },
      midnight,
    );

    const delivery = {
      deliveryId: nanoid(),
      submittedBy: row.provider,
      description: body.description,
      refs: body.refs,
      outputHash,
      submittedAt: new Date().toISOString(),
      chainJobId: chainJob.jobId,
    };
    const deliveries = [...(row.deliveries ?? []), delivery];

    if (chainJob.status !== "finalized") {
      await db
        .update(escrows)
        .set({ deliveries, updatedAt: new Date() })
        .where(eq(escrows.escrowId, escrowId));
      return c.json({ ...toApiEscrow(row), chainJob, outputHash, status: "submitted" }, 202);
    }

    await applyEscrowTransition(escrowId, "deliver", {
      deliveries,
      deliveredAt: new Date(),
    });
    if (row.jobId) {
      await db
        .update(jobs)
        .set({ status: "delivered", updatedAt: new Date() })
        .where(eq(jobs.id, row.jobId));
    }
    await createInboxItem({
      agentId: row.client,
      type: "TASK_UPDATE",
      title: "Delivery submitted",
      body: body.description,
      metadata: { escrowId, outputHash },
    });
    const updated = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    return c.json({ ...toApiEscrow(updated!), chainJob, outputHash });
  });

  app.post("/escrow/:escrowId/accept-delivery", requireDirectoryAuth, async (c) => {
    const escrowId = c.req.param("escrowId");
    const body = z
      .object({
        signedIntent: z.custom<SignedTransactionIntent>().optional(),
      })
      .catchall(z.any())
      .parse(await c.req.json().catch(() => ({})));
    const row = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    if (!row) return c.json({ error: "Escrow not found" }, 404);
    assertParty("client", c.get("auth").agentId, row.client, row.provider);

    if (body.signedIntent) {
      const intentCheck = await enforceSignedIntent(body.signedIntent, {
        actor: c.get("auth").agentId,
        action: "accept_delivery",
        resourceId: escrowId,
      });
      if (!intentCheck.ok) {
        return c.json({ error: intentCheck.error, code: "INVALID_SIGNED_INTENT" }, (intentCheck.status as any) ?? 403);
      }
    }

    const releaseJob = await createChainJob(
      {
        kind: "escrow_release",
        agentId: row.client,
        resourceType: "escrow",
        resourceId: escrowId,
        payload: {
          escrowId,
          callerCommitment: row.clientCryptoId ?? row.client,
          buyerCommitment: row.clientCryptoId ?? row.client,
        },
        idempotencyKey: `escrow_release:${escrowId}`,
      },
      midnight,
    );

    if (releaseJob.status !== "finalized") {
      return c.json({ ...toApiEscrow(row), chainJob: releaseJob, status: "submitted" }, 202);
    }

    await applyEscrowTransition(escrowId, "accept_delivery");
    await applyEscrowTransition(escrowId, "release", {
      resolvedAt: new Date(),
      onChainTx: releaseJob.txHash,
    });

    await db.insert(ledgerEntries).values({
      id: nanoid(),
      kind: "escrow_release",
      fromAgentId: row.client,
      toAgentId: row.provider,
      amount: row.amount,
      asset: row.asset,
      network: row.network,
      txHash: releaseJob.txHash,
      resourceType: "escrow",
      resourceId: escrowId,
    });

    await db.insert(reputationEvents).values({
      id: nanoid(),
      agentId: row.provider,
      kind: "job_completed",
      delta: 10,
      resourceType: "escrow",
      resourceId: escrowId,
      txHash: releaseJob.txHash,
    });

    if (row.jobId) {
      await db
        .update(jobs)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(jobs.id, row.jobId));
    }

    const updated = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    return c.json({ ...toApiEscrow(updated!), chainJob: releaseJob });
  });

  app.post("/escrow/:escrowId/dispute", requireDirectoryAuth, async (c) => {
    const escrowId = c.req.param("escrowId");
    const body = z
      .object({
        reason: z.string(),
        signedIntent: z.custom<SignedTransactionIntent>().optional(),
      })
      .parse(await c.req.json());
    const row = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    if (!row) return c.json({ error: "Escrow not found" }, 404);
    const actor = c.get("auth").agentId;
    if (actor !== row.client && actor !== row.provider) {
      return c.json({ error: "Forbidden" }, 403);
    }

    if (body.signedIntent) {
      const intentCheck = await enforceSignedIntent(body.signedIntent, {
        actor,
        action: "dispute_escrow",
        resourceId: escrowId,
      });
      if (!intentCheck.ok) {
        return c.json({ error: intentCheck.error, code: "INVALID_SIGNED_INTENT" }, (intentCheck.status as any) ?? 403);
      }
    }

    const disputeJob = await createChainJob(
      {
        kind: "escrow_dispute",
        agentId: actor,
        resourceType: "escrow",
        resourceId: escrowId,
        payload: { escrowId, reason: body.reason, callerCommitment: actor },
        idempotencyKey: `escrow_dispute:${escrowId}`,
      },
      midnight,
    );

    await applyEscrowTransition(escrowId, "dispute", {
      dispute: {
        disputeId: nanoid(),
        escrowId,
        tier: "mediation",
        openedBy: actor,
        reason: body.reason,
        status: "open",
        openedAt: new Date().toISOString(),
      },
    });
    const updated = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    return c.json({ ...toApiEscrow(updated!), chainJob: disputeJob });
  });

  app.post("/escrow/:escrowId/refund", requireDirectoryAuth, async (c) => {
    const escrowId = c.req.param("escrowId");
    const body = z
      .object({
        signedIntent: z.custom<SignedTransactionIntent>().optional(),
      })
      .catchall(z.any())
      .parse(await c.req.json().catch(() => ({})));
    const row = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    if (!row) return c.json({ error: "Escrow not found" }, 404);
    assertParty("client", c.get("auth").agentId, row.client, row.provider);

    if (body.signedIntent) {
      const intentCheck = await enforceSignedIntent(body.signedIntent, {
        actor: c.get("auth").agentId,
        action: "refund_escrow",
        resourceId: escrowId,
      });
      if (!intentCheck.ok) {
        return c.json({ error: intentCheck.error, code: "INVALID_SIGNED_INTENT" }, (intentCheck.status as any) ?? 403);
      }
    }

    // Verify refund eligibility: disputed OR past deadline
    const deadlineMs = row.terms && typeof row.terms === "object" && "deadline" in row.terms
      ? new Date((row.terms as { deadline: string }).deadline).getTime()
      : 0;
    const isDisputed = row.status === "disputed";
    const isExpired = deadlineMs > 0 && Date.now() >= deadlineMs;

    if (!isDisputed && !isExpired) {
      return c.json(
        {
          error: "Escrow is not eligible for refund (must be disputed or past deadline)",
          code: "NOT_REFUNDABLE",
        },
        400,
      );
    }

    const refundJob = await createChainJob(
      {
        kind: "escrow_refund",
        agentId: row.client,
        resourceType: "escrow",
        resourceId: escrowId,
        payload: {
          escrowId,
          callerCommitment: row.clientCryptoId ?? row.client,
          buyerCommitment: row.clientCryptoId ?? row.client,
        },
        idempotencyKey: `escrow_refund:${escrowId}`,
      },
      midnight,
    );

    if (refundJob.status !== "finalized") {
      return c.json({ ...toApiEscrow(row), chainJob: refundJob, status: "submitted" }, 202);
    }

    await applyEscrowTransition(escrowId, "refund", {
      resolvedAt: new Date(),
      onChainTx: refundJob.txHash,
    });

    if (row.jobId) {
      await db
        .update(jobs)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(jobs.id, row.jobId));
    }

    const updated = await db.query.escrows.findFirst({
      where: eq(escrows.escrowId, escrowId),
    });
    return c.json({ ...toApiEscrow(updated!), chainJob: refundJob });
  });

  return app;
}
