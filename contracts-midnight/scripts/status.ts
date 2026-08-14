import { getNetworkConfig } from "./config.ts";
import { readDeploymentState } from "./deploy.ts";

async function main(): Promise<void> {
  const config = getNetworkConfig();
  const checks = await Promise.allSettled([
    fetch(`${config.node.replace(/\/$/u, "")}/health`).then(async (r) => ({
      node: r.ok ? "up" : `http ${r.status}`,
    })),
    fetch(config.indexer, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
    }).then(async (r) => ({ indexer: r.ok ? "up" : `http ${r.status}` })),
    fetch(`${config.proofServer.replace(/\/$/u, "")}/version`)
      .then(async (r) => ({ proofServer: r.ok ? await r.text() : `http ${r.status}` }))
      .catch(() => ({ proofServer: "unreachable" })),
  ]);
  const state = readDeploymentState();
  console.log(
    JSON.stringify(
      {
        network: config.networkId,
        endpoints: {
          node: config.node,
          indexer: config.indexer,
          proofServer: config.proofServer,
        },
        health: checks.map((c) => (c.status === "fulfilled" ? c.value : { error: String(c.reason) })),
        deployment: state ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
