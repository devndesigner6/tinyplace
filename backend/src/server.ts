import { Hono } from "hono";
import { cors } from "hono/cors";

import { config } from "./config.js";
import { chainRoutes } from "./routes/chain.js";
import { directoryRoutes } from "./routes/directory.js";
import { escrowRoutes } from "./routes/escrow.js";
import { eventsRoutes } from "./routes/events.js";
import { graphqlRoutes } from "./routes/graphql.js";
import { groupsRoutes } from "./routes/groups.js";
import { healthRoutes } from "./routes/health.js";
import { inboxRoutes } from "./routes/inbox.js";
import { keysRoutes } from "./routes/keys.js";
import { ledgerRoutes } from "./routes/ledger.js";
import { marketplaceRoutes } from "./routes/marketplace.js";
import { messagesRoutes } from "./routes/messages.js";
import { paymentsRoutes } from "./routes/payments.js";
import { profilesRoutes } from "./routes/profiles.js";
import { registryRoutes } from "./routes/registry.js";
import { reputationRoutes } from "./routes/reputation.js";
import { searchRoutes } from "./routes/search.js";
import { explorerRoutes, statsRoutes } from "./routes/stats.js";
import { usersRoutes } from "./routes/users.js";
import { createMidnightProvider } from "./services/midnight/provider.js";

export function createApp() {
  const app = new Hono();
  const midnight = createMidnightProvider();

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return "*";
        if (config.CORS_ORIGIN === "*" || config.CORS_ORIGIN === origin) return origin;
        if (origin.endsWith(".vercel.app") || origin.includes("localhost") || origin.includes("127.0.0.1")) return origin;
        return config.CORS_ORIGIN;
      },
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-TinyPlace-Date",
        "X-TinyPlace-Nonce",
        "X-TinyPlace-Public-Key",
        "X-TinyPlace-Signature",
        "X-Payment",
        "X-Agent-ID",
      ],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  );

  app.use("*", async (c, next) => {
    c.header("X-TinyPlace-Backend", "self-hosted");
    c.header("X-TinyPlace-Settlement", config.SETTLEMENT_NETWORK);
    c.header("X-TinyPlace-Midnight-Network", midnight.network());
    await next();
  });

  app.route("/", healthRoutes);
  app.route("/", registryRoutes(midnight));
  app.route("/", directoryRoutes);
  app.route("/", groupsRoutes());
  app.route("/", eventsRoutes());
  app.route("/", profilesRoutes);
  app.route("/", searchRoutes);
  app.route("/", keysRoutes);
  app.route("/", messagesRoutes);
  app.route("/", inboxRoutes);
  app.route("/", marketplaceRoutes(midnight));
  app.route("/", escrowRoutes(midnight));
  app.route("/", paymentsRoutes(midnight));
  app.route("/", ledgerRoutes);
  app.route("/", chainRoutes(midnight));
  app.route("/", reputationRoutes);
  app.route("/", statsRoutes);
  app.route("/", explorerRoutes);
  app.route("/", usersRoutes);
  app.route("/", graphqlRoutes);

  app.notFound((c) =>
    c.json({ error: "Not found", code: "NOT_FOUND", path: c.req.path }, 404),
  );

  app.onError((error, c) => {
    console.error(error);
    return c.json(
      {
        error: error.message ?? "Internal server error",
        code: "INTERNAL_ERROR",
      },
      500,
    );
  });

  return app;
}
