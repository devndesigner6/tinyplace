import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { config } from "../config.js";
import { hashCommitment } from "../auth/crypto.js";

export async function storeEncryptedArtifact(input: {
  jobId?: string;
  escrowId?: string;
  uploaderAgentId: string;
  direction: "input" | "output";
  ciphertext: Buffer;
  mimeType?: string;
}): Promise<{ storageKey: string; contentHash: string; sizeBytes: number }> {
  const root = path.resolve(config.ARTIFACT_STORAGE_PATH);
  await mkdir(root, { recursive: true });
  const storageKey = `${input.direction}/${Date.now()}_${hashCommitment(input.ciphertext).slice(0, 16)}.bin`;
  const fullPath = path.join(root, storageKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, input.ciphertext);
  return {
    storageKey,
    contentHash: hashCommitment(input.ciphertext),
    sizeBytes: input.ciphertext.byteLength,
  };
}

export async function readArtifact(storageKey: string): Promise<Buffer> {
  const fullPath = path.join(path.resolve(config.ARTIFACT_STORAGE_PATH), storageKey);
  return readFile(fullPath);
}
