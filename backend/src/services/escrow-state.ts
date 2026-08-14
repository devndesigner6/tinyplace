/**
 * Escrow state machine — mirrors the Midnight Escrow contract.
 * Backend projections may only advance when chain events confirm transitions
 * for chain-authoritative escrows.
 */

export type EscrowFsmStatus =
  | "created"
  | "pending_fund"
  | "funded"
  | "accepted"
  | "delivered"
  | "revision_requested"
  | "accepted_delivery"
  | "released"
  | "disputed"
  | "resolved"
  | "refunded"
  | "expired"
  | "cancelled";

export type EscrowAction =
  | "prepare_fund"
  | "confirm_fund"
  | "accept"
  | "deliver"
  | "request_revision"
  | "accept_delivery"
  | "release"
  | "dispute"
  | "resolve"
  | "refund"
  | "expire"
  | "cancel";

const TRANSITIONS: Record<EscrowFsmStatus, Partial<Record<EscrowAction, EscrowFsmStatus>>> = {
  created: { prepare_fund: "pending_fund", cancel: "cancelled" },
  pending_fund: { confirm_fund: "funded", cancel: "cancelled" },
  funded: {
    accept: "accepted",
    deliver: "delivered",
    dispute: "disputed",
    expire: "expired",
    cancel: "cancelled",
  },
  accepted: {
    deliver: "delivered",
    dispute: "disputed",
    expire: "expired",
  },
  delivered: {
    request_revision: "revision_requested",
    accept_delivery: "accepted_delivery",
    dispute: "disputed",
  },
  revision_requested: {
    deliver: "delivered",
    dispute: "disputed",
  },
  accepted_delivery: { release: "released" },
  disputed: { resolve: "resolved", refund: "refunded" },
  resolved: {},
  refunded: {},
  released: {},
  expired: { refund: "refunded" },
  cancelled: {},
};

export function canTransition(
  current: EscrowFsmStatus,
  action: EscrowAction,
): boolean {
  return TRANSITIONS[current]?.[action] !== undefined;
}

export function nextStatus(
  current: EscrowFsmStatus,
  action: EscrowAction,
): EscrowFsmStatus {
  const next = TRANSITIONS[current]?.[action];
  if (!next) {
    throw new Error(`Invalid escrow transition: ${current} + ${action}`);
  }
  return next;
}

export function assertParty(
  role: "client" | "provider",
  actor: string,
  client: string,
  provider: string,
): void {
  const expected = role === "client" ? client : provider;
  if (actor !== expected && actor !== client && actor !== provider) {
    throw new Error(`Actor ${actor} is not ${role} for this escrow`);
  }
  if (role === "client" && actor !== client) {
    throw new Error(`Only client ${client} may perform this action`);
  }
  if (role === "provider" && actor !== provider) {
    throw new Error(`Only provider ${provider} may perform this action`);
  }
}
