import type { SigningKey } from "../auth.js";
import type { HttpClient } from "../http.js";
import { createMidnightSignedIntent } from "../midnight-intent.js";

export type MarketplaceProduct = {
  productId: string;
  title: string;
  description: string;
  category?: string;
  price: {
    amount: string;
    asset: string;
    network: string;
  };
  sellerAgentId: string;
  active?: boolean;
};

export type MarketplaceJob = {
  jobId: string;
  listingVersionId: string;
  listingVersionHash: string;
  jobCommitment: string;
  status: string;
  sellerAgentId: string;
  buyerAgentId: string;
  price: {
    amount: string;
    asset: string;
    network: string;
  };
};

export class MarketplaceApi {
  constructor(
    private readonly http: HttpClient,
    private readonly signingKey?: SigningKey,
  ) {}

  listProducts(): Promise<{ products: Array<MarketplaceProduct> }> {
    return this.http.get<{ products: Array<MarketplaceProduct> }>(
      "/marketplace/products",
    );
  }

  getProduct(productId: string): Promise<MarketplaceProduct & Record<string, unknown>> {
    return this.http.get(`/marketplace/products/${encodeURIComponent(productId)}`);
  }

  async createProduct(request: {
    listingId?: string;
    title: string;
    description: string;
    category?: string;
    priceAmount: string;
    priceAsset?: string;
    priceNetwork?: string;
  }): Promise<Record<string, unknown>> {
    const listingId = request.listingId ?? `lst_${globalThis.crypto.randomUUID()}`;
    const priceAsset = request.priceAsset ?? "NIGHT";
    const priceNetwork = request.priceNetwork ?? "midnight:preprod";
    const health = await this.http.get<{ contracts?: { listingRegistry?: string } }>("/healthz");
    const signedIntent = await createMidnightSignedIntent(this.signingKey, {
      action: "anchor_listing",
      amount: request.priceAmount,
      asset: priceAsset,
      contractAddress: health.contracts?.listingRegistry ?? "",
      network: priceNetwork,
      resourceId: listingId,
    });
    return this.http.postDirectoryAuth("/marketplace/products", {
      ...request,
      listingId,
      priceAsset,
      priceNetwork,
      signedIntent,
    });
  }

  createJob(productId: string, request?: Record<string, unknown>): Promise<MarketplaceJob> {
    return this.http.postDirectoryAuth<MarketplaceJob>(
      `/marketplace/products/${encodeURIComponent(productId)}/jobs`,
      request ?? {},
    );
  }
}
