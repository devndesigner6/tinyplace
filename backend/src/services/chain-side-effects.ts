import { eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { handles, listingVersions } from "../db/schema.js";

export async function applyChainJobSideEffects(
  kind: string,
  payload: Record<string, unknown>,
  txHash?: string,
  status?: string,
): Promise<void> {
  if (status !== "finalized") return;

  if (kind === "handle_claim") {
    const handle = String(payload["handle"] ?? "");
    if (handle) {
      await db
        .update(handles)
        .set({
          status: "active",
          chainTxHash: txHash,
          registeredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(handles.name, handle));
    }
  }

  if (kind === "listing_anchor") {
    const listingId = String(payload["listingId"] ?? "");
    if (listingId) {
      await db
        .update(listingVersions)
        .set({
          chainAnchored: true,
          chainCommitmentTx: txHash,
        })
        .where(eq(listingVersions.listingId, listingId));
    }
  }
}
