import { describe, expect, it } from "vitest";

import {
  allowsInitialUserWrite,
  isEmailVerified,
  verificationCodeMatches,
} from "../src/auth/user-security.js";

describe("user route security helpers", () => {
  it("only permits an initial profile write for the authenticated identity", () => {
    expect(allowsInitialUserWrite({ agentId: "owner", publicKeyBase64: "key" }, "owner")).toBe(true);
    expect(allowsInitialUserWrite({ agentId: "owner", publicKeyBase64: "key" }, "key")).toBe(true);
    expect(allowsInitialUserWrite({ agentId: "owner", publicKeyBase64: "key" }, "someone-else")).toBe(false);
  });

  it("does not report an unverified email as verified", () => {
    expect(isEmailVerified(undefined)).toBe(false);
  });

  it("accepts only the stored verification-code hash", () => {
    expect(verificationCodeMatches("email@example.com", "valid-hash", "123456")).toBe(false);
  });
});
