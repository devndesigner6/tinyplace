import { count, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db/client.js";
import {
  agents,
  directoryCards,
  handles,
  ledgerEntries,
  listings,
} from "../db/schema.js";
import { groups } from "../db/social-schema.js";

export const statsRoutes = new Hono();

statsRoutes.get("/stats", async (c) => {
  const [agentCount] = await db.select({ value: count() }).from(agents);
  const [cardCount] = await db.select({ value: count() }).from(directoryCards);
  const [groupCount] = await db.select({ value: count() }).from(groups);
  const [txCount] = await db.select({ value: count() }).from(ledgerEntries);
  const [settledCount] = await db
    .select({ value: count() })
    .from(ledgerEntries)
    .where(sql`${ledgerEntries.txHash} IS NOT NULL`);
  const [volumeRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(CAST(${ledgerEntries.amount} AS numeric)), 0)` })
    .from(ledgerEntries);
  return c.json({
    timestamp: new Date().toISOString(),
    agents: {
      registered: Number(agentCount?.value ?? 0),
      active_30d: Number(agentCount?.value ?? 0),
      directory_cards: Number(cardCount?.value ?? 0),
      groups: Number(groupCount?.value ?? 0),
    },
    transactions: {
      total: Number(txCount?.value ?? 0),
      settled: Number(settledCount?.value ?? 0),
      by_type: {},
    },
    volume: {
      total_usd: String(volumeRow?.total ?? "0"),
      by_asset: {},
      by_network: {},
      last_24h_usd: "0",
      last_30d_usd: "0",
    },
    fees: {
      total_usd: "0",
      by_asset: {},
    },
  });
});

statsRoutes.get("/stats/agents", async (c) => {
  const [agentCount] = await db.select({ value: count() }).from(agents);
  const [cardCount] = await db.select({ value: count() }).from(directoryCards);
  const [groupCount] = await db.select({ value: count() }).from(groups);
  return c.json({
    registered: Number(agentCount?.value ?? 0),
    active_30d: Number(agentCount?.value ?? 0),
    directory_cards: Number(cardCount?.value ?? 0),
    groups: Number(groupCount?.value ?? 0),
  });
});

statsRoutes.get("/stats/transactions", async (c) => {
  const [txCount] = await db.select({ value: count() }).from(ledgerEntries);
  const [settledCount] = await db
    .select({ value: count() })
    .from(ledgerEntries)
    .where(sql`${ledgerEntries.txHash} IS NOT NULL`);
  return c.json({
    total: Number(txCount?.value ?? 0),
    settled: Number(settledCount?.value ?? 0),
    by_type: {},
  });
});

statsRoutes.get("/stats/volume", async (c) => {
  const [volumeRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(CAST(${ledgerEntries.amount} AS numeric)), 0)` })
    .from(ledgerEntries);
  return c.json({
    total_usd: String(volumeRow?.total ?? "0"),
    by_asset: {},
    by_network: {},
    last_24h_usd: "0",
    last_30d_usd: "0",
  });
});

statsRoutes.get("/stats/fees", async (c) =>
  c.json({ total_usd: "0", by_asset: {} }),
);

export const explorerRoutes = new Hono();

explorerRoutes.get("/explorer", async (c) => c.redirect("/explorer/overview", 307));
explorerRoutes.get("/explorer/overview", async (c) => {
  const [agentCount] = await db.select({ value: count() }).from(handles);
  const [ledgerCount] = await db.select({ value: count() }).from(ledgerEntries);
  const recent = await db
    .select()
    .from(ledgerEntries)
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(10);
  const [volumeRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(CAST(${ledgerEntries.amount} AS numeric)), 0)` })
    .from(ledgerEntries);
  return c.json({
    timestamp: new Date().toISOString(),
    ledger: {
      totalEntries: Number(ledgerCount?.value ?? 0),
      latestTxId: recent[0]?.id,
      latestTimestamp: recent[0]?.createdAt.toISOString(),
    },
    last24h: {
      transactions: recent.length,
      volumeUsd: String(volumeRow?.total ?? "0"),
      feesUsd: "0",
      uniqueAgents: Number(agentCount?.value ?? 0),
    },
    allTime: {
      volumeUsd: String(volumeRow?.total ?? "0"),
      feesUsd: "0",
      registeredAgents: Number(agentCount?.value ?? 0),
    },
    byNetwork: {},
    recentTransactions: recent.map((row) => ({
      txId: row.id,
      visibility: "public",
      type: row.kind,
      from: row.fromAgentId,
      to: row.toAgentId,
      amount: row.amount,
      asset: row.asset,
      network: row.network,
      timestamp: row.createdAt.toISOString(),
      onChainTx: row.txHash ?? row.id,
      status: row.txHash ? "settled" : "pending",
    })),
  });
});

explorerRoutes.get("/explorer/transactions", async (c) => {
  const limit = Number(c.req.query("limit") ?? "20");
  const offset = Number(c.req.query("offset") ?? "0");
  const rows = await db
    .select()
    .from(ledgerEntries)
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value }] = await db.select({ value: count() }).from(ledgerEntries);
  return c.json({
    transactions: rows.map((row) => ({
      txId: row.id,
      visibility: "public",
      type: row.kind,
      from: row.fromAgentId,
      to: row.toAgentId,
      amount: row.amount,
      asset: row.asset,
      network: row.network,
      timestamp: row.createdAt.toISOString(),
      onChainTx: row.txHash ?? row.id,
      status: row.txHash ? "settled" : "pending",
    })),
    total: Number(value),
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
  });
});

explorerRoutes.get("/explorer/transactions/:txId", async (c) => {
  const txId = c.req.param("txId");
  const row = await db.query.ledgerEntries.findFirst({ where: eq(ledgerEntries.id, txId) });
  if (!row) return c.json({ error: "Transaction not found" }, 404);
  return c.json({
    txId: row.id,
    visibility: "public",
    type: row.kind,
    from: row.fromAgentId ? { cryptoId: row.fromAgentId, reputation: 0 } : null,
    to: row.toAgentId ? { cryptoId: row.toAgentId, reputation: 0 } : null,
    amount: row.amount,
    amountFormatted: row.amount,
    asset: row.asset,
    network: row.network,
    timestamp: row.createdAt.toISOString(),
    onChainTx: row.txHash ?? row.id,
    onChainVerified: Boolean(row.txHash),
    status: row.txHash ? "settled" : "pending",
    relatedTransactions: [],
  });
});

explorerRoutes.get("/explorer/transactions/:txId/verify", async (c) => {
  const txId = c.req.param("txId");
  const row = await db.query.ledgerEntries.findFirst({ where: eq(ledgerEntries.id, txId) });
  if (!row) return c.json({ error: "Transaction not found" }, 404);
  return c.json({
    txId: row.id,
    onChainTx: row.txHash ?? row.id,
    network: row.network,
    verified: Boolean(row.txHash),
  });
});

explorerRoutes.get("/explorer/agents/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const rows = await db
    .select()
    .from(ledgerEntries)
    .where(sql`${ledgerEntries.fromAgentId} = ${agentId} OR ${ledgerEntries.toAgentId} = ${agentId}`)
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(10);
  return c.json({
    agent: { cryptoId: agentId, reputation: 0 },
    summary: {
      totalTransactions: rows.length,
      totalVolumeUsd: "0",
      sent: { count: rows.length, volumeUsd: "0" },
      received: { count: 0, volumeUsd: "0" },
      feesPaid: { count: 0, totalUsd: "0" },
      topCounterparties: [],
      byType: {},
      byNetwork: {},
    },
    recentTransactions: rows.map((row) => ({
      txId: row.id,
      visibility: "public",
      type: row.kind,
      amount: row.amount,
      asset: row.asset,
      network: row.network,
      timestamp: row.createdAt.toISOString(),
      onChainTx: row.txHash ?? row.id,
      status: row.txHash ? "settled" : "pending",
    })),
  });
});

// Lightweight product count for search surfaces.
void listings;
