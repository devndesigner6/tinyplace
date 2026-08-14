import { Hono } from "hono";

import { config } from "../config.js";
import type { MidnightProvider } from "../services/midnight/provider.js";

export function paymentsRoutes(midnight: MidnightProvider) {
  const app = new Hono();

  app.get("/payments/supported", (c) =>
    c.json({
      networks: [
        {
          id: midnight.network(),
          settlement: config.SETTLEMENT_NETWORK,
          assets: ["NIGHT", "DUST"],
          schemes: ["midnight-exact"],
          contracts: midnight.contractAddresses(),
        },
        ...(config.SETTLEMENT_NETWORK === "solana"
          ? [
              {
                id: "solana:devnet",
                assets: ["SOL", "USDC"],
                schemes: ["exact"],
                legacy: true,
              },
            ]
          : []),
      ],
    }),
  );

  app.post("/payments/verify", async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    return c.json({
      valid: Boolean(body["txHash"] ?? body["midnightTxHash"]),
      network: midnight.network(),
      verifiedAt: new Date().toISOString(),
    });
  });

  app.post("/payments/settle", async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const txHash = String(body["txHash"] ?? body["midnightTxHash"] ?? "");
    const observed = txHash ? await midnight.observeTx(txHash) : { status: "permanent_failure" as const };
    return c.json({
      settled: observed.status === "finalized",
      txHash: observed.txHash,
      status: observed.status,
    });
  });

  return app;
}
