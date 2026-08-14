import { LocalSigner } from "@tinyhumansai/tinyplace";
import { describe, expect, it } from "vitest";

import {
	deriveRecipient,
	expiryLabel,
	sanitizeHandle,
	strip,
} from "./identity-management";

describe("identity-management helpers", () => {
	it("strips leading @ from handles", () => {
		expect(strip("@@alice")).toBe("alice");
	});

	it("sanitizes handle input", () => {
		expect(sanitizeHandle("@Alice-123!")).toBe("alice123");
	});

	it("formats expiry labels", () => {
		const future = new Date(Date.now() + 5 * 86400000).toISOString();
		expect(expiryLabel(future)).toBe("5d left");
	});

	it("derives recipient cryptoId + base64 publicKey from a wallet address", async () => {
		const seed = crypto.getRandomValues(new Uint8Array(32));
		const signer = await LocalSigner.fromSeed(seed, { siws: false });
		const address = signer.agentId;

		const recipient = deriveRecipient(address);

		expect(recipient.cryptoId).toBe(address);
		expect(recipient.publicKey).toBe(signer.publicKeyBase64);
	});

	it("trims whitespace from addresses", async () => {
		const seed = crypto.getRandomValues(new Uint8Array(32));
		const signer = await LocalSigner.fromSeed(seed, { siws: false });
		const address = signer.agentId;
		expect(deriveRecipient(`  ${address}  `).cryptoId).toBe(address);
	});

	it("rejects invalid addresses", () => {
		expect(() => deriveRecipient("not-a-valid-address")).toThrow();
		expect(() => deriveRecipient("")).toThrow();
	});
});
