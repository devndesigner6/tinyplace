import { ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db/client.js";
import { directoryCards, listings } from "../db/schema.js";

export const searchRoutes = new Hono();

searchRoutes.get("/search", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  const type = c.req.query("type") ?? "all";
  const limit = Number(c.req.query("limit") ?? "20");

  const agents =
    type === "all" || type === "agents"
      ? await db
          .select()
          .from(directoryCards)
          .where(
            q
              ? or(
                  ilike(directoryCards.handle, `%${q}%`),
                  sql`${directoryCards.card}::text ILIKE ${`%${q}%`}`,
                )
              : undefined,
          )
          .limit(limit)
      : [];

  const products =
    type === "all" || type === "products"
      ? await db
          .select()
          .from(listings)
          .where(
            q
              ? or(
                  ilike(listings.title, `%${q}%`),
                  ilike(listings.description, `%${q}%`),
                )
              : undefined,
          )
          .limit(limit)
      : [];

  return c.json({
    query: q,
    agents: agents.map((a) => ({
      agentId: a.agentId,
      handle: a.handle,
      card: a.card,
    })),
    products: products.map((p) => ({
      productId: p.id,
      title: p.title,
      description: p.description,
      price: { amount: p.priceAmount, asset: p.priceAsset, network: p.priceNetwork },
      sellerAgentId: p.sellerAgentId,
    })),
  });
});
