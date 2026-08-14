import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "../db/client.js";
import { chainJobs } from "../db/schema.js";
import { applyChainJobSideEffects } from "./chain-side-effects.js";
import type { MidnightProvider } from "./midnight/provider.js";

export type ChainJobKind =
  | "handle_claim"
  | "listing_anchor"
  | "escrow_fund"
  | "escrow_deliver"
  | "escrow_accept"
  | "escrow_release"
  | "escrow_dispute"
  | "escrow_refund"
  | "attestation_anchor";

export type CreateChainJobInput = {
  kind: ChainJobKind;
  agentId?: string;
  resourceType?: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  submittedTxHash?: string;
};

export async function createChainJob(
  input: CreateChainJobInput,
  midnight: MidnightProvider,
): Promise<{ jobId: string; status: string; txHash?: string }> {
  if (input.idempotencyKey) {
    const existing = await db.query.chainJobs.findFirst({
      where: eq(chainJobs.idempotencyKey, input.idempotencyKey),
    });
    if (existing) {
      return {
        jobId: existing.id,
        status: existing.status,
        txHash: existing.txHash ?? undefined,
      };
    }
  }

  const jobId = nanoid();
  await db.insert(chainJobs).values({
    id: jobId,
    kind: input.kind,
    status: "queued",
    agentId: input.agentId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    payload: input.payload ?? {},
    idempotencyKey: input.idempotencyKey,
  });

  const result = await midnight.submitJob({
    jobId,
    kind: input.kind,
    payload: input.payload ?? {},
    submittedTxHash: input.submittedTxHash,
  });

  await db
    .update(chainJobs)
    .set({
      status: result.status,
      txHash: result.txHash,
      contractAddress: result.contractAddress,
      updatedAt: new Date(),
      finalizedAt: result.status === "finalized" ? new Date() : undefined,
    })
    .where(eq(chainJobs.id, jobId));

  await applyChainJobSideEffects(
    input.kind,
    input.payload ?? {},
    result.txHash,
    result.status,
  );

  return { jobId, status: result.status, txHash: result.txHash };
}

export async function getChainJob(jobId: string) {
  return db.query.chainJobs.findFirst({ where: eq(chainJobs.id, jobId) });
}
