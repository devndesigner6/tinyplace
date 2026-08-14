import type { HttpClient } from "../http.js";

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
  constructor(private readonly http: HttpClient) {}

  listProducts(): Promise<{ products: Array<MarketplaceProduct> }> {
    return this.http.get<{ products: Array<MarketplaceProduct> }>(
      "/marketplace/products",
    );
  }

  getProduct(productId: string): Promise<MarketplaceProduct & Record<string, unknown>> {
    return this.http.get(`/marketplace/products/${encodeURIComponent(productId)}`);
  }

  createProduct(request: {
    title: string;
    description: string;
    category?: string;
    priceAmount: string;
    priceAsset?: string;
    priceNetwork?: string;
  }): Promise<Record<string, unknown>> {
    return this.http.postDirectoryAuth("/marketplace/products", request);
  }

  createJob(productId: string, request?: Record<string, unknown>): Promise<MarketplaceJob> {
    return this.http.postDirectoryAuth<MarketplaceJob>(
      `/marketplace/products/${encodeURIComponent(productId)}/jobs`,
      request ?? {},
    );
  }
}
