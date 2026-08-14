import { Hono } from "hono";

import { config } from "../config.js";
import { createMidnightProvider } from "../services/midnight/provider.js";
import {
  contractsDeployed,
  hackathonDevFallbackEnabled,
} from "../services/hackathon-dev.js";

export const healthRoutes = new Hono();

healthRoutes.get("/healthz", (c) => {
  const midnight = createMidnightProvider();
  const contracts = midnight.contractAddresses();
  return c.json({
    status: "ok",
    settlement: config.SETTLEMENT_NETWORK,
    midnightNetwork: midnight.network(),
    contracts,
    contractsReady: contractsDeployed(midnight),
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
