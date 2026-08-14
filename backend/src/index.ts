import { serve } from "@hono/node-server";

import { config } from "./config.js";
import { createApp } from "./server.js";

const app = createApp();

serve(
  {
    fetch: app.fetch,
    port: config.PORT,
  },
  (info) => {
    console.log(
      `tiny.place backend listening on http://localhost:${info.port} (${config.MIDNIGHT_NETWORK})`,
    );
  },
);
