import { describe, expect, it } from "vitest";

import {
  canTransition,
  nextStatus,
} from "../src/services/escrow-state.js";

describe("escrow state machine", () => {
  it("follows fund → deliver → accept → release", () => {
    expect(canTransition("created", "prepare_fund")).toBe(true);
    expect(nextStatus("created", "prepare_fund")).toBe("pending_fund");
    expect(nextStatus("pending_fund", "confirm_fund")).toBe("funded");
    expect(nextStatus("funded", "deliver")).toBe("delivered");
    expect(nextStatus("delivered", "accept_delivery")).toBe("accepted_delivery");
    expect(nextStatus("accepted_delivery", "release")).toBe("released");
  });

  it("rejects double release path", () => {
    expect(canTransition("released", "release")).toBe(false);
  });

  it("allows dispute from funded", () => {
    expect(nextStatus("funded", "dispute")).toBe("disputed");
  });
});
