import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { config } from "../config.js";
import { createApp } from "../server.js";

/**
 * Minimal MCP-compatible HTTP surface for agent tools.
 * Full MCP stdio transport can wrap these endpoints.
 */
const mcp = new Hono();

mcp.get("/tools", (c) =>
  c.json({
    tools: [
      "resolve_handle",
      "search_listings",
      "create_job",
      "accept_job",
      "check_escrow",
      "submit_delivery",
      "fund_escrow",
      "verify_attestation",
    ],
  }),
);

mcp.post("/tools/:name", async (c) => {
  const api = createApp();
  const name = c.req.param("name");
  const body = await c.req.json<Record<string, unknown>>();

  switch (name) {
    case "resolve_handle": {
      const res = await api.request(
        `/registry/names/${encodeURIComponent(String(body["handle"]))}`,
      );
      return c.json(await res.json());
    }
    case "search_listings": {
      const res = await api.request("/marketplace/products");
      return c.json(await res.json());
    }
    case "check_escrow": {
      const res = await api.request(`/escrow/${encodeURIComponent(String(body["escrowId"]))}`, {
        headers: c.req.raw.headers,
      });
      return c.json(await res.json());
    }
    default:
      return c.json({ error: `Unknown tool: ${name}` }, 404);
  }
});

serve(
  {
    fetch: mcp.fetch,
    port: config.PORT + 1,
  },
  (info) => {
    console.log(`MCP gateway listening on http://localhost:${info.port}`);
  },
);
