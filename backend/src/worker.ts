import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { Redis } from "ioredis";
import { nanoid } from "nanoid";

import { config } from "./config.js";
import { db } from "./db/client.js";
import { chainEvents, chainJobs, handles } from "./db/schema.js";
import { createMidnightProvider } from "./services/midnight/provider.js";

const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const midnight = createMidnightProvider();

const worker = new Worker(
  "midnight-jobs",
  async (job) => {
    const { jobId, kind, payload, submittedTxHash } = job.data as {
      jobId: string;
      kind: string;
      payload: Record<string, unknown>;
      submittedTxHash?: string;
    };

    await db
      .update(chainJobs)
      .set({ status: "preparing", updatedAt: new Date() })
      .where(eq(chainJobs.id, jobId));

    const result = await midnight.submitJob({
      jobId,
      kind,
      payload,
      submittedTxHash,
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

    if (result.txHash && result.eventName) {
      await db.insert(chainEvents).values({
        id: nanoid(),
        contractAddress: result.contractAddress ?? "unknown",
        eventName: result.eventName,
        txHash: result.txHash,
        payload: result.eventPayload ?? payload,
      });
    }

    if (kind === "handle_claim" && result.status === "finalized") {
      const handle = String(payload["handle"] ?? "");
      if (handle) {
        await db
          .update(handles)
          .set({
            status: "active",
            chainTxHash: result.txHash,
            registeredAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(handles.name, handle));
      }
    }

    return result;
  },
  { connection },
);

worker.on("completed", (job) => {
  console.log(`Chain job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Chain job failed: ${job?.id}`, error);
});

console.log("Midnight worker started");
