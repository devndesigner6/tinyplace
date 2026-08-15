import { Hono } from "hono";

import { config } from "../config.js";
import { createMidnightProvider } from "../services/midnight/provider.js";
import {
  contractsDeployed,
  hackathonDevFallbackEnabled,
} from "../services/hackathon-dev.js";

export const healthRoutes = new Hono();

healthRoutes.get("/healthz", async (c) => {
  const midnight = createMidnightProvider();
  const contracts = midnight.contractAddresses();
  
  let indexerReachable = false;
  try {
    const res = await fetch(config.MIDNIGHT_INDEXER_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ block { height } }" }),
    });
    indexerReachable = res.ok;
  } catch {
    indexerReachable = false;
  }

  const isReady = contractsDeployed(midnight) && (config.MIDNIGHT_NETWORK !== "preprod" || indexerReachable);

  return c.json({
    status: "ok",
    settlement: config.SETTLEMENT_NETWORK,
    midnightNetwork: midnight.network(),
    contracts,
    contractsReady: isReady,
    indexerConnected: indexerReachable,
    hackathonDevMode: config.HACKATHON_DEV_MODE,
    hackathonDevFallback: hackathonDevFallbackEnabled(midnight),
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get("/version", (c) =>
  c.json({
    name: "@tinyplace/backend",
    version: "0.1.0",
    settlement: config.SETTLEMENT_NETWORK,
  }),
);
