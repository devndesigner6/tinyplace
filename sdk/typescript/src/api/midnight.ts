import type { HttpClient } from "../http.js";
import type {
  MidnightChainJob,
  MidnightPaymentChallenge,
} from "../midnight/types.js";

export class MidnightApi {
  constructor(private readonly http: HttpClient) {}

  network(): Promise<{ network: string; contracts: Record<string, string | undefined> }> {
    return this.http.get("/chain/network");
  }

  getChainJob(jobId: string): Promise<MidnightChainJob & Record<string, unknown>> {
    return this.http.get(`/chain/jobs/${encodeURIComponent(jobId)}`);
  }

  getFundChallenge(escrowId: string): Promise<MidnightPaymentChallenge> {
    return this.http.postDirectoryAuth<{ payment: MidnightPaymentChallenge }>(
      `/escrow/${encodeURIComponent(escrowId)}/fund-intent`,
      {},
    ).then((r) => r.payment);
  }

  submitFundTx(
    escrowId: string,
    midnightTxHash: string,
    idempotencyKey?: string,
  ): Promise<Record<string, unknown>> {
    return this.http.postDirectoryAuth(
      `/escrow/${encodeURIComponent(escrowId)}/fund`,
      { midnightTxHash, idempotencyKey },
    );
  }

  observeTx(txHash: string): Promise<Record<string, unknown>> {
    return this.http.post("/chain/observe", { txHash });
  }
}
