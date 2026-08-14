import { config } from "../config.js";
import type { MidnightProvider } from "./midnight/provider.js";

export function contractsDeployed(midnight: MidnightProvider): boolean {
  const addresses = midnight.contractAddresses();
  return Boolean(
    addresses.handleRegistry &&
      addresses.listingRegistry &&
      addresses.escrow,
  );
}

/** When true, API flows succeed without on-chain settlement (UI demo only). */
export function hackathonDevFallbackEnabled(
  midnight: MidnightProvider,
): boolean {
  return config.HACKATHON_DEV_MODE && !contractsDeployed(midnight);
}
