import { config } from "./config.js";
import { createMidnightProvider } from "./services/midnight/provider.js";

const midnight = createMidnightProvider();

async function pollIndexer(): Promise<void> {
  console.log(
    `Indexer polling ${config.MIDNIGHT_INDEXER_URL} (${midnight.network()})`,
  );
  // Preprod GraphQL subscription wiring lands here when proof server is configured.
  // Local mode relies on immediate finalization in the worker simulator.
}

async function main(): Promise<void> {
  await pollIndexer();
  setInterval(() => {
    void pollIndexer();
  }, 30_000);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
