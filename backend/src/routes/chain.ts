import { Hono } from "hono";

import { getChainJob } from "../services/chain-jobs.js";
import type { MidnightProvider } from "../services/midnight/provider.js";

export function chainRoutes(midnight: MidnightProvider) {
  const app = new Hono();

  app.get("/chain/network", (c) =>
    c.json({
      network: midnight.network(),
      contracts: midnight.contractAddresses(),
    }),
  );

  app.get("/chain/jobs/:jobId", async (c) => {
    const job = await getChainJob(c.req.param("jobId"));
    if (!job) return c.json({ error: "Chain job not found" }, 404);
    return c.json({
      jobId: job.id,
      kind: job.kind,
      status: job.status,
      txHash: job.txHash,
      contractAddress: job.contractAddress,
      resourceType: job.resourceType,
      resourceId: job.resourceId,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      finalizedAt: job.finalizedAt?.toISOString(),
    });
  });

  app.post("/chain/observe", async (c) => {
    const body = await c.req.json<{ txHash: string }>();
    const observed = await midnight.observeTx(body.txHash);
    return c.json(observed);
  });

  return app;
}
