import { sha256 } from "@noble/hashes/sha2.js";
import * as ed25519 from "@noble/ed25519";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const ED25519_PUBLIC_KEY_BYTES = 32;

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

export function sha256Hex(data: Uint8Array | string): string {
  const input =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  return toHex(sha256(input));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      output[key] = sortValue(input[key]);
    }
    return output;
  }
  return value;
}

export function canonicalPayload(
  action: string,
  fields: Record<string, unknown>,
): string {
  return stableStringify({ action, fields });
}

function decodeBase58(value: string): Uint8Array {
  if (value.length === 0) return new Uint8Array();
  let decoded = 0n;
  for (const char of value) {
    const digit = BASE58_ALPHABET.indexOf(char);
    if (digit === -1) throw new Error(`Invalid base58 character: ${char}`);
    decoded = decoded * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (decoded > 0n) {
    bytes.push(Number(decoded & 0xffn));
    decoded >>= 8n;
  }
  bytes.reverse();
  let leadingZeroes = 0;
  for (const char of value) {
    if (char !== "1") break;
    leadingZeroes += 1;
  }
  const result = new Uint8Array(leadingZeroes + bytes.length);
  result.set(bytes, leadingZeroes);
  return result;
}

export function publicKeyToBase58(publicKey: Uint8Array): string {
  let encoded = 0n;
  for (const byte of publicKey) {
    encoded = (encoded << 8n) + BigInt(byte);
  }
  let value = "";
  while (encoded > 0n) {
    const digit = Number(encoded % 58n);
    value = BASE58_ALPHABET[digit]! + value;
    encoded /= 58n;
  }
  for (const byte of publicKey) {
    if (byte !== 0) break;
    value = "1" + value;
  }
  return value || "1";
}

export function cryptoIdToPublicKey(cryptoId: string): Uint8Array {
  const publicKeyBytes = decodeBase58(cryptoId);
  if (publicKeyBytes.length !== ED25519_PUBLIC_KEY_BYTES) {
    throw new Error(
      `cryptoId does not decode to a ${ED25519_PUBLIC_KEY_BYTES}-byte Ed25519 public key`,
    );
  }
  return publicKeyBytes;
}

export function cryptoIdToPublicKeyBase64(cryptoId: string): string {
  return toBase64(cryptoIdToPublicKey(cryptoId));
}

export async function verifyEd25519(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  return ed25519.verify(signature, message, publicKey);
}

export function hashCommitment(value: unknown): string {
  return sha256Hex(new TextEncoder().encode(stableStringify(value)));
}

export function normalizeHandle(name: string): string {
  const trimmed = name.trim();
  return trimmed.startsWith("@") ? trimmed.toLowerCase() : `@${trimmed.toLowerCase()}`;
}

export function isValidHandleLabel(name: string): boolean {
  const label = normalizeHandle(name).slice(1);
  return /^[a-z0-9]{1,64}$/.test(label);
}

const RESERVED = new Set([
  "admin",
  "system",
  "tinyplace",
  "api",
  "www",
  "root",
  "support",
]);

export function isReservedHandle(name: string): boolean {
  const label = normalizeHandle(name).slice(1);
  return RESERVED.has(label);
}
