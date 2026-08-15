import * as ed from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha2.js";
import { sha512 } from "@noble/hashes/sha512.js";

import { db } from "../db/client.js";
import { authNonces } from "../db/schema.js";
import { cryptoIdToPublicKey } from "./crypto.js";

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
  publicKeyBase64: string;
}

const memoryNonceCache = new Set<string>();

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
 * Validates the cryptographic signature, timestamp freshness, actor identity binding,
 * and atomically commits nonce replay defense AFTER verifying the signature.
 */
export async function verifySignedIntent(
  signed: SignedTransactionIntent,
  options: { maxSkewMs?: number } = {},
): Promise<{ valid: boolean; error?: string }> {
  // 1. Mandatory structure validation
  if (!signed.signatureHex || signed.signatureHex.trim() === "") {
    return { valid: false, error: "Cryptographic signature is mandatory on transaction intent" };
  }
  if (!signed.publicKeyBase64 || signed.publicKeyBase64.trim() === "") {
    return { valid: false, error: "Public key is mandatory on transaction intent" };
  }

  // 2. Actor identity binding validation
  let derivedPublicKeyBase64: string;
  try {
    if (signed.actor.startsWith("did:") || signed.actor.includes(":")) {
      const pubKeyBytes = cryptoIdToPublicKey(signed.actor);
      derivedPublicKeyBase64 = Buffer.from(pubKeyBytes).toString("base64");
    } else {
      derivedPublicKeyBase64 = signed.actor;
    }
  } catch {
    derivedPublicKeyBase64 = signed.actor;
  }

  if (
    derivedPublicKeyBase64 !== signed.publicKeyBase64 &&
    signed.actor !== signed.publicKeyBase64
  ) {
    return {
      valid: false,
      error: `Actor mismatch: intent actor ${signed.actor} does not match provided public key`,
    };
  }

  // 3. Timestamp expiration & skew validation
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

  // 4. Verify Cryptographic Ed25519 signature BEFORE touching DB or registering nonce
  const intentHash = serializeIntentForSigning(signed);

  try {
    const pubKeyBytes = Buffer.from(signed.publicKeyBase64, "base64");
    const sigBytes = Buffer.from(signed.signatureHex, "hex");
    const isValid = await ed.verify(sigBytes, intentHash, pubKeyBytes);
    if (!isValid) {
      return { valid: false, error: "Invalid cryptographic signature on transaction intent" };
    }
  } catch (err) {
    return {
      valid: false,
      error: `Signature verification error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 5. Atomic Persistent Nonce Replay Defense via PostgreSQL ON CONFLICT DO NOTHING RETURNING
  const nonceKey = `intent:${signed.actor}:${signed.nonce}`;
  if (memoryNonceCache.has(nonceKey)) {
    return { valid: false, error: "Intent nonce has already been used (replay detected)" };
  }

  if (db) {
    try {
      const inserted = await db
        .insert(authNonces)
        .values({ nonce: nonceKey })
        .onConflictDoNothing()
        .returning({ nonce: authNonces.nonce });

      if (!inserted || inserted.length === 0) {
        return { valid: false, error: "Intent nonce has already been used (replay detected in DB)" };
      }
    } catch (err: any) {
      if (err?.code === "23505" || err?.message?.includes("unique")) {
        return { valid: false, error: "Intent nonce has already been used (replay conflict)" };
      }
      if (process.env.NODE_ENV === "production") {
        return { valid: false, error: `Database nonce persistence failure: ${err?.message || err}` };
      }
    }
  }

  memoryNonceCache.add(nonceKey);
  return { valid: true };
}

/**
 * Validates signed intent strictly against all expected endpoint mutation parameters.
 */
export async function enforceSignedIntent(
  reqSignedIntent: SignedTransactionIntent | undefined,
  expected: {
    actor: string;
    action: TransactionIntent["action"];
    contractAddress?: string;
    network?: string;
    resourceId: string;
    amount?: string;
    asset?: string;
  },
  options: { required?: boolean } = { required: true },
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const isRequired = options.required ?? true;
  if (!reqSignedIntent) {
    if (isRequired) {
      return { ok: false, error: "Cryptographically signed transaction intent is required", status: 401 };
    }
    return { ok: true };
  }

  if (reqSignedIntent.actor !== expected.actor) {
    return { ok: false, error: `Intent actor mismatch: expected ${expected.actor}, got ${reqSignedIntent.actor}`, status: 403 };
  }

  if (reqSignedIntent.action !== expected.action) {
    return { ok: false, error: `Intent action mismatch: expected ${expected.action}, got ${reqSignedIntent.action}`, status: 400 };
  }

  if (reqSignedIntent.resourceId !== expected.resourceId) {
    return { ok: false, error: `Intent resourceId mismatch: expected ${expected.resourceId}, got ${reqSignedIntent.resourceId}`, status: 400 };
  }

  if (expected.contractAddress && reqSignedIntent.contractAddress !== expected.contractAddress) {
    return { ok: false, error: `Intent contractAddress mismatch: expected ${expected.contractAddress}, got ${reqSignedIntent.contractAddress}`, status: 400 };
  }

  if (expected.network && reqSignedIntent.network !== expected.network) {
    return { ok: false, error: `Intent network mismatch: expected ${expected.network}, got ${reqSignedIntent.network}`, status: 400 };
  }

  if (expected.amount !== undefined) {
    if (!reqSignedIntent.amount || reqSignedIntent.amount !== expected.amount) {
      return { ok: false, error: `Intent amount mismatch: expected ${expected.amount}, got ${reqSignedIntent.amount ?? "undefined"}`, status: 400 };
    }
  }

  if (expected.asset !== undefined) {
    if (!reqSignedIntent.asset || reqSignedIntent.asset !== expected.asset) {
      return { ok: false, error: `Intent asset mismatch: expected ${expected.asset}, got ${reqSignedIntent.asset ?? "undefined"}`, status: 400 };
    }
  }

  const result = await verifySignedIntent(reqSignedIntent);
  if (!result.valid) {
    return { ok: false, error: result.error ?? "Invalid signed intent", status: 403 };
  }

  return { ok: true };
}
