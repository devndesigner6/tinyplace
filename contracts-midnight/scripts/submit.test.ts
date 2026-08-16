import assert from "node:assert/strict";
import test from "node:test";

import { submitWithRetry } from "./submit.ts";

test("retries a transient Midnight WebSocket closure", async () => {
  let attempts = 0;

  const hash = await submitWithRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("disconnected from wss://rpc.preprod.midnight.network/: 1000:: Normal Closure");
    return "tx-hash";
  }, { delayMs: 0 });

  assert.equal(hash, "tx-hash");
  assert.equal(attempts, 3);
});

test("does not retry a non-transient submission error", async () => {
  let attempts = 0;

  await assert.rejects(
    () => submitWithRetry(async () => {
      attempts += 1;
      throw new Error("Invalid Transaction");
    }, { delayMs: 0 }),
    /Invalid Transaction/,
  );

  assert.equal(attempts, 1);
});
