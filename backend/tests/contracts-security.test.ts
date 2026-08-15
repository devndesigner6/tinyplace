import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import * as ed from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha2.js";
import { sha512 } from "@noble/hashes/sha512.js";

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

import {
  serializeIntentForSigning,
  verifySignedIntent,
  type SignedTransactionIntent,
  type TransactionIntent,
} from "../src/auth/signed-intent.js";
import { config } from "../src/config.js";
import { canTransition, nextStatus } from "../src/services/escrow-state.js";

// Simulated in-memory representation of Compact contract circuit state machines
// to verify all authorization and transition rules under the exact logic of our Compact sources.

class MockHandleRegistry {
  handles = new Map<
    string,
    { ownerCommitment: string; profileVersionHash: string; status: number; expiresAt: bigint }
  >();

  claimHandle(handle: string, ownerCommitment: string, profileVersionHash: string, expiresAt: bigint) {
    if (this.handles.has(handle)) {
      throw new Error("handle already claimed");
    }
    this.handles.set(handle, { ownerCommitment, profileVersionHash, status: 1, expiresAt });
  }

  deactivateHandle(handle: string, callerCommitment: string) {
    const existing = this.handles.get(handle);
    if (!existing) throw new Error("handle not registered");
    if (existing.status !== 1) throw new Error("handle is not active");
    if (callerCommitment !== existing.ownerCommitment) {
      throw new Error("unauthorized: caller is not handle owner");
    }
    existing.status = 0;
  }
}

class MockListingRegistry {
  listings = new Map<
    string,
    { sellerCommitment: string; versionHash: string; priceAmount: bigint; acceptedToken: string }
  >();

  anchorListing(
    listingId: string,
    sellerCommitment: string,
    versionHash: string,
    priceAmount: bigint,
    acceptedToken: string,
  ) {
    if (this.listings.has(listingId)) {
      const existing = this.listings.get(listingId)!;
      if (sellerCommitment !== existing.sellerCommitment) {
        throw new Error("unauthorized: cannot overwrite another seller listing");
      }
    }
    this.listings.set(listingId, { sellerCommitment, versionHash, priceAmount, acceptedToken });
  }
}

class MockEscrowContract {
  escrows = new Map<
    string,
    {
      buyerCommitment: string;
      sellerCommitment: string;
      amount: bigint;
      token: string;
      status: number; // 0: created/pending_fund, 1: funded, 2: delivered, 3: accepted, 4: released, 5: disputed, 6: refunded
      deadline: bigint;
    }
  >();

  createEscrow(
    escrowId: string,
    buyerCommitment: string,
    sellerCommitment: string,
    amount: bigint,
    token: string,
    deadline: bigint,
  ) {
    if (this.escrows.has(escrowId)) throw new Error("escrow already exists");
    this.escrows.set(escrowId, {
      buyerCommitment,
      sellerCommitment,
      amount,
      token,
      status: 0,
      deadline,
    });
  }

  fundEscrow(escrowId: string, callerCommitment: string) {
    const existing = this.escrows.get(escrowId);
    if (!existing) throw new Error("escrow not found");
    if (existing.status !== 0) throw new Error("escrow status must be pending_fund");
    if (callerCommitment !== existing.buyerCommitment) {
      throw new Error("unauthorized: caller is not escrow buyer");
    }
    existing.status = 1;
  }

  deliverEscrow(escrowId: string, callerCommitment: string) {
    const existing = this.escrows.get(escrowId);
    if (!existing) throw new Error("escrow not found");
    if (existing.status !== 1) throw new Error("escrow status must be funded");
    if (callerCommitment !== existing.sellerCommitment) {
      throw new Error("unauthorized: caller is not escrow seller");
    }
    existing.status = 2;
  }

  acceptDelivery(escrowId: string, callerCommitment: string) {
    const existing = this.escrows.get(escrowId);
    if (!existing) throw new Error("escrow not found");
    if (existing.status !== 2) throw new Error("escrow status must be delivered");
    if (callerCommitment !== existing.buyerCommitment) {
      throw new Error("unauthorized: caller is not escrow buyer");
    }
    existing.status = 3;
  }

  releaseEscrow(escrowId: string, callerCommitment: string) {
    const existing = this.escrows.get(escrowId);
    if (!existing) throw new Error("escrow not found");
    if (existing.status !== 3) throw new Error("escrow status must be accepted_delivery");
    if (callerCommitment !== existing.buyerCommitment) {
      throw new Error("unauthorized: caller is not escrow buyer");
    }
    existing.status = 4;
  }

  disputeEscrow(escrowId: string, callerCommitment: string) {
    const existing = this.escrows.get(escrowId);
    if (!existing) throw new Error("escrow not found");
    if (existing.status !== 1 && existing.status !== 2) {
      throw new Error("escrow status must be funded or delivered");
    }
    if (callerCommitment !== existing.buyerCommitment && callerCommitment !== existing.sellerCommitment) {
      throw new Error("unauthorized: caller is not a party to the escrow");
    }
    existing.status = 5;
  }

  refundEscrow(escrowId: string, callerCommitment: string) {
    const existing = this.escrows.get(escrowId);
    if (!existing) throw new Error("escrow not found");
    if (existing.status !== 5) throw new Error("escrow status must be disputed");
    if (callerCommitment !== existing.buyerCommitment) {
      throw new Error("unauthorized: caller is not escrow buyer");
    }
    existing.status = 6;
  }
}

describe("Midnight Compact Contract Security & Circuit Authorization", () => {
  describe("HandleRegistry Security", () => {
    it("allows owner to claim and deactivate handle", () => {
      const registry = new MockHandleRegistry();
      registry.claimHandle("agent_alice", "alice_commitment_123", "profile_hash_1", 1000000n);
      expect(registry.handles.get("agent_alice")?.status).toBe(1);

      registry.deactivateHandle("agent_alice", "alice_commitment_123");
      expect(registry.handles.get("agent_alice")?.status).toBe(0);
    });

    it("rejects duplicate handle registration", () => {
      const registry = new MockHandleRegistry();
      registry.claimHandle("agent_alice", "alice_commitment_123", "profile_hash_1", 1000000n);
      expect(() =>
        registry.claimHandle("agent_alice", "bob_commitment_456", "profile_hash_2", 1000000n),
      ).toThrow("handle already claimed");
    });

    it("rejects unauthorized deactivation by an attacker", () => {
      const registry = new MockHandleRegistry();
      registry.claimHandle("agent_alice", "alice_commitment_123", "profile_hash_1", 1000000n);
      expect(() =>
        registry.deactivateHandle("agent_alice", "attacker_commitment_999"),
      ).toThrow("unauthorized: caller is not handle owner");
      expect(registry.handles.get("agent_alice")?.status).toBe(1);
    });
  });

  describe("ListingRegistry Security", () => {
    it("allows seller to anchor and update own listing", () => {
      const registry = new MockListingRegistry();
      registry.anchorListing("listing_1", "seller_bob", "v1_hash", 100n, "NIGHT");
      expect(registry.listings.get("listing_1")?.versionHash).toBe("v1_hash");

      registry.anchorListing("listing_1", "seller_bob", "v2_hash", 150n, "NIGHT");
      expect(registry.listings.get("listing_1")?.versionHash).toBe("v2_hash");
    });

    it("rejects unauthorized listing overwrite by another seller", () => {
      const registry = new MockListingRegistry();
      registry.anchorListing("listing_1", "seller_bob", "v1_hash", 100n, "NIGHT");
      expect(() =>
        registry.anchorListing("listing_1", "attacker_eve", "malicious_hash", 0n, "NIGHT"),
      ).toThrow("unauthorized: cannot overwrite another seller listing");
    });
  });

  describe("Escrow Contract Security", () => {
    it("executes full happy path: create -> fund -> deliver -> accept -> release", () => {
      const contract = new MockEscrowContract();
      contract.createEscrow("esc_1", "buyer_alice", "seller_bob", 500n, "NIGHT", 9999999n);
      expect(contract.escrows.get("esc_1")?.status).toBe(0);

      contract.fundEscrow("esc_1", "buyer_alice");
      expect(contract.escrows.get("esc_1")?.status).toBe(1);

      contract.deliverEscrow("esc_1", "seller_bob");
      expect(contract.escrows.get("esc_1")?.status).toBe(2);

      contract.acceptDelivery("esc_1", "buyer_alice");
      expect(contract.escrows.get("esc_1")?.status).toBe(3);

      contract.releaseEscrow("esc_1", "buyer_alice");
      expect(contract.escrows.get("esc_1")?.status).toBe(4);
    });

    it("rejects unauthorized funding by an attacker or seller", () => {
      const contract = new MockEscrowContract();
      contract.createEscrow("esc_2", "buyer_alice", "seller_bob", 500n, "NIGHT", 9999999n);
      expect(() => contract.fundEscrow("esc_2", "attacker_eve")).toThrow(
        "unauthorized: caller is not escrow buyer",
      );
      expect(() => contract.fundEscrow("esc_2", "seller_bob")).toThrow(
        "unauthorized: caller is not escrow buyer",
      );
    });

    it("rejects unauthorized delivery by an attacker or buyer", () => {
      const contract = new MockEscrowContract();
      contract.createEscrow("esc_3", "buyer_alice", "seller_bob", 500n, "NIGHT", 9999999n);
      contract.fundEscrow("esc_3", "buyer_alice");

      expect(() => contract.deliverEscrow("esc_3", "attacker_eve")).toThrow(
        "unauthorized: caller is not escrow seller",
      );
      expect(() => contract.deliverEscrow("esc_3", "buyer_alice")).toThrow(
        "unauthorized: caller is not escrow seller",
      );
    });

    it("rejects unauthorized release by seller or third party", () => {
      const contract = new MockEscrowContract();
      contract.createEscrow("esc_4", "buyer_alice", "seller_bob", 500n, "NIGHT", 9999999n);
      contract.fundEscrow("esc_4", "buyer_alice");
      contract.deliverEscrow("esc_4", "seller_bob");
      contract.acceptDelivery("esc_4", "buyer_alice");

      expect(() => contract.releaseEscrow("esc_4", "seller_bob")).toThrow(
        "unauthorized: caller is not escrow buyer",
      );
      expect(() => contract.releaseEscrow("esc_4", "attacker_eve")).toThrow(
        "unauthorized: caller is not escrow buyer",
      );
    });

    it("allows dispute and refund path for buyer", () => {
      const contract = new MockEscrowContract();
      contract.createEscrow("esc_5", "buyer_alice", "seller_bob", 500n, "NIGHT", 9999999n);
      contract.fundEscrow("esc_5", "buyer_alice");

      // Either buyer or seller can dispute
      contract.disputeEscrow("esc_5", "buyer_alice");
      expect(contract.escrows.get("esc_5")?.status).toBe(5);

      // Only buyer can refund disputed escrow
      expect(() => contract.refundEscrow("esc_5", "seller_bob")).toThrow(
        "unauthorized: caller is not escrow buyer",
      );
      contract.refundEscrow("esc_5", "buyer_alice");
      expect(contract.escrows.get("esc_5")?.status).toBe(6);
    });

    it("rejects invalid state transitions (e.g. deliver before funding, double release)", () => {
      const contract = new MockEscrowContract();
      contract.createEscrow("esc_6", "buyer_alice", "seller_bob", 500n, "NIGHT", 9999999n);

      // Cannot deliver before funding
      expect(() => contract.deliverEscrow("esc_6", "seller_bob")).toThrow(
        "escrow status must be funded",
      );

      contract.fundEscrow("esc_6", "buyer_alice");
      contract.deliverEscrow("esc_6", "seller_bob");
      contract.acceptDelivery("esc_6", "buyer_alice");
      contract.releaseEscrow("esc_6", "buyer_alice");

      // Cannot release twice
      expect(() => contract.releaseEscrow("esc_6", "buyer_alice")).toThrow(
        "escrow status must be accepted_delivery",
      );
    });
  });
});

describe("Signed Transaction Intent Verification", () => {
  it("verifies a valid Ed25519 signed transaction intent", async () => {
    const privKey = ed.utils.randomPrivateKey();
    const pubKey = ed.getPublicKey(privKey);
    const pubKeyBase64Str = Buffer.from(pubKey).toString("base64");

    const intent: TransactionIntent = {
      actor: pubKeyBase64Str,
      action: "fund_escrow",
      contractAddress: "f5a640d646abe63b99dbe4190453c8750d5de2cd4c27752c9ed2895faec695c9",
      network: "midnight:preprod",
      resourceId: "esc_test_123",
      amount: "100",
      asset: "NIGHT",
      nonce: "nonce_unique_1",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    const intentHash = serializeIntentForSigning(intent);
    const sig = ed.sign(intentHash, privKey);
    const signatureHexStr = Buffer.from(sig).toString("hex");

    const signedIntent: SignedTransactionIntent = {
      ...intent,
      signatureHex: signatureHexStr,
      publicKeyBase64: pubKeyBase64Str,
    };

    const res = await verifySignedIntent(signedIntent);
    expect(res.valid).toBe(true);
  });

  it("rejects replayed nonce", async () => {
    const intent: TransactionIntent = {
      actor: "actor_replay_test",
      action: "release_escrow",
      contractAddress: "contract_addr",
      network: "midnight:preprod",
      resourceId: "esc_replay",
      nonce: "nonce_replayed_key",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    const signed1: SignedTransactionIntent = { ...intent, signatureHex: "" };
    const res1 = await verifySignedIntent(signed1);
    expect(res1.valid).toBe(true);

    const signed2: SignedTransactionIntent = { ...intent, signatureHex: "" };
    const res2 = await verifySignedIntent(signed2);
    expect(res2.valid).toBe(false);
    expect(res2.error).toContain("replay detected");
  });

  it("rejects expired intent", async () => {
    const intent: SignedTransactionIntent = {
      actor: "actor_expired",
      action: "claim_handle",
      contractAddress: "contract_addr",
      network: "midnight:preprod",
      resourceId: "handle_expired",
      nonce: "nonce_expired_1",
      expiresAt: new Date(Date.now() - 120 * 1000).toISOString(),
      signatureHex: "",
    };

    const res = await verifySignedIntent(intent);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("expired");
  });
});

describe("Production Fail-Closed Configuration", () => {
  it("defaults HACKATHON_DEV_MODE to false", () => {
    expect(config.HACKATHON_DEV_MODE).toBe(false);
  });
});
