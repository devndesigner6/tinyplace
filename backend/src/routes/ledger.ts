import { desc } from "drizzle-orm";
import { Hono } from "hono";

export const ledgerRoutes = new Hono();

ledgerRoutes.get("/ledger/transactions", async (c) => {
  const { db } = await import("../db/client.js");
  const { ledgerEntries } = await import("../db/schema.js");
  const limit = Number(c.req.query("limit") ?? "50");
  const rows = await db
    .select()
    .from(ledgerEntries)
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(limit);
  return c.json({
    transactions: rows.map((row) => ({
      txId: row.id,
      kind: row.kind,
      from: row.fromAgentId,
      to: row.toAgentId,
      amount: row.amount,
      asset: row.asset,
      network: row.network,
      onChainTx: row.txHash,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      createdAt: row.createdAt.toISOString(),
      metadata: row.metadata,
    })),
  });
});
