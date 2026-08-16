import { sha256 } from "@noble/hashes/sha2.js";

import type { SigningKey } from "./auth.js";
import { identityPublicKey } from "./signer.js";

export type MidnightIntentAction =
  | "claim_handle"
  | "anchor_listing"
  | "create_escrow"
  | "fund_escrow"
  | "deliver_escrow"
  | "accept_delivery"
  | "dispute_escrow"
  | "refund_escrow";

export type MidnightSignedIntent = {
  action: MidnightIntentAction;
  actor: string;
  amount?: string;
  asset?: string;
  contractAddress: string;
  expiresAt: string;
  network: string;
  nonce: string;
  publicKeyBase64: string;
  resourceId: string;
  signatureHex: string;
};

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createMidnightSignedIntent(
  signer: SigningKey | undefined,
  input: Omit<MidnightSignedIntent, "actor" | "expiresAt" | "nonce" | "publicKeyBase64" | "signatureHex">,
): Promise<MidnightSignedIntent> {
  const publicKeyBase64 = signer ? identityPublicKey(signer) : undefined;
  if (!signer || !publicKeyBase64) {
    throw new Error("A signer with a public key is required for Midnight settlement.");
  }
  const intent = {
    ...input,
    actor: publicKeyBase64,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    nonce: globalThis.crypto.randomUUID(),
    publicKeyBase64,
  };
  const payload = [
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
  const signature = await signer.sign(sha256(new TextEncoder().encode(payload)));
  return { ...intent, signatureHex: hex(signature) };
}
