import * as ed from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha2.js";
import { sha512 } from "@noble/hashes/sha512.js";

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

export interface TransactionIntent {
  actor: string;
  action:
    | "claim_handle"
    | "deactivate_handle"
    | "anchor_listing"
    | "create_escrow"
    | "fund_escrow"
    | "deliver_escrow"
    | "accept_delivery"
    | "release_escrow"
    | "dispute_escrow"
    | "refund_escrow";
  contractAddress: string;
  network: string;
  resourceId: string;
  amount?: string;
  asset?: string;
  nonce: string;
  expiresAt: string;
}

export interface SignedTransactionIntent extends TransactionIntent {
  signatureHex: string;
  publicKeyBase64?: string;
}

const seenNonces = new Set<string>();

/**
 * Creates canonical deterministic bytes for signing an on-chain transaction intent.
 */
export function serializeIntentForSigning(intent: TransactionIntent): Uint8Array {
  const canonicalString = [
    intent.actor,
    intent.action,
    intent.contractAddress,
    intent.network,
    intent.resourceId,
    intent.amount ?? "",
    intent.asset ?? "",
    intent.nonce,
    intent.expiresAt,
  ].join("|");

  return sha256(new TextEncoder().encode(canonicalString));
}

/**
 * Validates the cryptographic signature, timestamp freshness, and nonce replay defense.
 */
export async function verifySignedIntent(
  signed: SignedTransactionIntent,
  options: { maxSkewMs?: number } = {},
): Promise<{ valid: boolean; error?: string }> {
  const maxSkewMs = options.maxSkewMs ?? 15 * 60 * 1000; // 15 minutes
  const expiryTime = new Date(signed.expiresAt).getTime();

  if (Number.isNaN(expiryTime)) {
    return { valid: false, error: "Invalid expiresAt timestamp in intent" };
  }

  const now = Date.now();
  if (expiryTime < now - 60_000) {
    return { valid: false, error: "Transaction intent has expired" };
  }

  if (expiryTime > now + maxSkewMs) {
    return { valid: false, error: "Transaction intent expires too far in the future" };
  }

  const nonceKey = `${signed.actor}:${signed.nonce}`;
  if (seenNonces.has(nonceKey)) {
    return { valid: false, error: "Intent nonce has already been used (replay detected)" };
  }

  const intentHash = serializeIntentForSigning(signed);

  // If public key base64 is provided, verify Ed25519 signature
  if (signed.publicKeyBase64 && signed.signatureHex) {
    try {
      const pubKeyBytes = Buffer.from(signed.publicKeyBase64, "base64");
      const sigBytes = Buffer.from(signed.signatureHex, "hex");
      const isValid = await ed.verify(sigBytes, intentHash, pubKeyBytes);
      if (!isValid) {
        return { valid: false, error: "Invalid cryptographic signature on transaction intent" };
      }
    } catch (err) {
      return { valid: false, error: `Signature verification error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  seenNonces.add(nonceKey);
  return { valid: true };
}
