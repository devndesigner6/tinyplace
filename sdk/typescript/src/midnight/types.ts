export type MidnightNetwork = "local" | "preprod" | "preview";

export type MidnightPaymentChallenge = {
  scheme: "midnight-exact";
  network: string;
  contract?: string;
  method: string;
  amount?: string;
  asset?: string;
  escrowId?: string;
  handle?: string;
  buyer?: string;
  jobCommitment?: string;
  ownerCommitment?: string;
  profileVersionHash?: string;
  expiresAt: string;
  nonce: string;
};

export type MidnightChainJobStatus =
  | "queued"
  | "preparing"
  | "proving"
  | "submitted"
  | "observed"
  | "finalized"
  | "retryable_failure"
  | "permanent_failure";

export type MidnightChainJob = {
  jobId: string;
  status: MidnightChainJobStatus;
  txHash?: string;
};

export function isMidnightPaymentChallenge(
  value: unknown,
): value is MidnightPaymentChallenge {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as MidnightPaymentChallenge).scheme === "midnight-exact"
  );
}
