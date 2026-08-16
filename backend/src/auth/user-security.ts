import { Buffer } from "node:buffer";

import { sha256 } from "@noble/hashes/sha2.js";

export type UserAuthIdentity = {
  agentId: string;
  publicKeyBase64?: string;
};

export function allowsInitialUserWrite(auth: UserAuthIdentity, targetAgentId: string): boolean {
  return auth.agentId === targetAgentId || auth.publicKeyBase64 === targetAgentId;
}

export function hashVerificationCode(email: string, code: string): string {
  return Buffer.from(
    sha256(new TextEncoder().encode(`${email.toLowerCase().trim()}:${code.trim()}`)),
  ).toString("hex");
}

export function verificationCodeMatches(email: string, storedHash: string, code: string): boolean {
  return storedHash === hashVerificationCode(email, code);
}

export function isEmailVerified(emailVerified: boolean | null | undefined): boolean {
  return emailVerified === true;
}
