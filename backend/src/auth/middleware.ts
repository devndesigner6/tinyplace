import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { authNonces } from "../db/schema.js";
import {
  cryptoIdToPublicKey,
  fromBase64,
  sha256Hex,
  verifyEd25519,
} from "./crypto.js";
import { config } from "../config.js";

export type AuthContext = {
  agentId: string;
  publicKeyBase64?: string;
};

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
    directoryAuth: AuthContext & { publicKeyBase64: string };
  }
}

function parseAuthHeader(header: string | undefined): {
  agentId: string;
  signature: string;
  timestamp: string;
} | null {
  if (!header?.startsWith("tiny.place ")) return null;
  const rest = header.slice("tiny.place ".length);
  const parts = rest.split(":");
  if (parts.length < 3) return null;
  const timestamp = parts.pop()!;
  const signature = parts.pop()!;
  const agentId = parts.join(":");
  if (!agentId || !signature || !timestamp) return null;
  return { agentId, signature, timestamp };
}

async function isReplayNonce(nonce: string): Promise<boolean> {
  const existing = await db.query.authNonces.findFirst({
    where: eq(authNonces.nonce, nonce),
  });
  if (existing) return true;
  await db.insert(authNonces).values({ nonce });
  return false;
}

function isFreshTimestamp(timestamp: string): boolean {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return false;
  return Math.abs(Date.now() - parsed) <= config.AUTH_TIMESTAMP_SKEW_MS;
}

export const requireAgentAuth = createMiddleware(async (c, next) => {
  const parsed = parseAuthHeader(c.req.header("Authorization"));
  if (!parsed) {
    return c.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, 401);
  }
  if (!isFreshTimestamp(parsed.timestamp)) {
    return c.json({ error: "Stale timestamp", code: "AUTH_STALE" }, 401);
  }
  const body = await c.req.raw.clone().text();
  const payload = new TextEncoder().encode(body + parsed.timestamp);
  let publicKey: Uint8Array;
  try {
    publicKey = cryptoIdToPublicKey(parsed.agentId);
  } catch {
    return c.json({ error: "Invalid agent id", code: "AUTH_INVALID" }, 401);
  }
  const valid = await verifyEd25519(
    publicKey,
    payload,
    fromBase64(parsed.signature),
  );
  if (!valid) {
    return c.json({ error: "Invalid signature", code: "AUTH_INVALID" }, 401);
  }
  c.set("auth", {
    agentId: parsed.agentId,
    publicKeyBase64: Buffer.from(publicKey).toString("base64"),
  });
  await next();
});

export async function verifyDirectoryWrite(
  method: string,
  requestUri: string,
  body: string,
  headers: Headers,
): Promise<AuthContext | null> {
  const date = headers.get("X-TinyPlace-Date");
  const nonce = headers.get("X-TinyPlace-Nonce");
  const publicKeyBase64 = headers.get("X-TinyPlace-Public-Key");
  const signatureB64 = headers.get("X-TinyPlace-Signature");
  if (!date || !nonce || !publicKeyBase64 || !signatureB64) return null;
  if (!isFreshTimestamp(date)) return null;
  if (await isReplayNonce(nonce)) return null;

  const bodyHash = sha256Hex(body);
  const signingPayload = `${method}\n${requestUri}\n${date}\n${nonce}\n${bodyHash}`;
  const publicKey = fromBase64(publicKeyBase64);
  const valid = await verifyEd25519(
    publicKey,
    new TextEncoder().encode(signingPayload),
    fromBase64(signatureB64),
  );
  if (!valid) return null;

  return { agentId: publicKeyBase64, publicKeyBase64 };
}

export const requireDirectoryAuth = createMiddleware(async (c, next) => {
  const url = new URL(c.req.url);
  const requestUri = url.pathname + url.search;
  const body = await c.req.raw.clone().text();
  const auth = await verifyDirectoryWrite(
    c.req.method,
    requestUri,
    body,
    c.req.raw.headers,
  );
  if (!auth) {
    return c.json(
      { error: "Directory auth required", code: "DIRECTORY_AUTH_REQUIRED" },
      401,
    );
  }
  c.set("directoryAuth", auth as AuthContext & { publicKeyBase64: string });
  c.set("auth", auth);
  await next();
});
