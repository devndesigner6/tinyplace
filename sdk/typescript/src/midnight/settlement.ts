import type { TinyPlaceClient } from "../client.js";
import type { MidnightChainJob, MidnightPaymentChallenge } from "./types.js";

export async function fundEscrowWithMidnight(
  client: TinyPlaceClient,
  escrowId: string,
  midnightTxHash: string,
  idempotencyKey?: string,
): Promise<{ result: Record<string, unknown>; chainJob: MidnightChainJob }> {
  const result = await client.midnight.submitFundTx(
    escrowId,
    midnightTxHash,
    idempotencyKey,
  );
  const chainJob = (result["chainJob"] ?? { jobId: "", status: "submitted" }) as MidnightChainJob;
  return { result, chainJob };
}

export async function getMidnightFundChallenge(
  client: TinyPlaceClient,
  escrowId: string,
): Promise<MidnightPaymentChallenge> {
  return client.midnight.getFundChallenge(escrowId);
}

export async function getChainJob(
  client: TinyPlaceClient,
  jobId: string,
): Promise<MidnightChainJob & Record<string, unknown>> {
  return client.midnight.getChainJob(jobId);
}
