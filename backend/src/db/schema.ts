import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const handleStatusEnum = pgEnum("handle_status", [
  "pending_chain",
  "active",
  "expired",
  "transferred",
  "deactivated",
]);

export const chainJobStatusEnum = pgEnum("chain_job_status", [
  "queued",
  "preparing",
  "proving",
  "submitted",
  "observed",
  "finalized",
  "retryable_failure",
  "permanent_failure",
]);

export const escrowStatusEnum = pgEnum("escrow_status", [
  "created",
  "pending_fund",
  "funded",
  "accepted",
  "delivered",
  "revision_requested",
  "accepted_delivery",
  "released",
  "disputed",
  "resolved",
  "refunded",
  "expired",
  "cancelled",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "draft",
  "awaiting_fund",
  "open",
  "in_progress",
  "delivered",
  "completed",
  "disputed",
  "cancelled",
]);

export const agents = pgTable(
  "agents",
  {
    id: text("id").primaryKey(),
    publicKeyBase64: text("public_key_base64").notNull(),
    midnightAddress: text("midnight_address"),
    actorType: text("actor_type").default("agent").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("agents_public_key_idx").on(table.publicKeyBase64)],
);

export const handles = pgTable(
  "handles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    status: handleStatusEnum("status").default("pending_chain").notNull(),
    profileVersionHash: text("profile_version_hash"),
    ownerCommitment: text("owner_commitment"),
    chainTxHash: text("chain_tx_hash"),
    contractAddress: text("contract_address"),
    registeredAt: timestamp("registered_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("handles_name_idx").on(table.name),
    index("handles_agent_idx").on(table.agentId),
  ],
);

export const profiles = pgTable("profiles", {
  agentId: text("agent_id")
    .primaryKey()
    .references(() => agents.id),
  displayName: text("display_name"),
  bio: text("bio"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  version: integer("version").default(1).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const directoryCards = pgTable(
  "directory_cards",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    handle: text("handle"),
    card: jsonb("card").$type<Record<string, unknown>>().notNull(),
    skillMd: text("skill_md"),
    tags: jsonb("tags").$type<Array<string>>().default([]),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("directory_cards_agent_idx").on(table.agentId),
    index("directory_cards_handle_idx").on(table.handle),
  ],
);

export const listings = pgTable(
  "listings",
  {
    id: text("id").primaryKey(),
    sellerAgentId: text("seller_agent_id")
      .notNull()
      .references(() => agents.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category"),
    priceAmount: text("price_amount").notNull(),
    priceAsset: text("price_asset").notNull(),
    priceNetwork: text("price_network").notNull().default("midnight:preprod"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("listings_seller_idx").on(table.sellerAgentId)],
);

export const listingVersions = pgTable(
  "listing_versions",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id),
    version: integer("version").notNull(),
    contentHash: text("content_hash").notNull(),
    chainCommitmentTx: text("chain_commitment_tx"),
    chainAnchored: boolean("chain_anchored").default(false).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("listing_versions_unique").on(table.listingId, table.version),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    listingVersionId: text("listing_version_id")
      .notNull()
      .references(() => listingVersions.id),
    buyerAgentId: text("buyer_agent_id")
      .notNull()
      .references(() => agents.id),
    sellerAgentId: text("seller_agent_id")
      .notNull()
      .references(() => agents.id),
    status: jobStatusEnum("status").default("draft").notNull(),
    jobCommitment: text("job_commitment").notNull(),
    escrowId: text("escrow_id"),
    deadline: timestamp("deadline", { withTimezone: true }),
    privacyRequirements: jsonb("privacy_requirements")
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("jobs_buyer_idx").on(table.buyerAgentId),
    index("jobs_seller_idx").on(table.sellerAgentId),
  ],
);

export const escrows = pgTable(
  "escrows",
  {
    escrowId: text("escrow_id").primaryKey(),
    jobId: text("job_id").references(() => jobs.id),
    status: escrowStatusEnum("status").default("created").notNull(),
    client: text("client").notNull(),
    clientCryptoId: text("client_crypto_id"),
    provider: text("provider").notNull(),
    providerCryptoId: text("provider_crypto_id"),
    amount: text("amount").notNull(),
    asset: text("asset").notNull(),
    network: text("network").notNull(),
    listingVersionHash: text("listing_version_hash"),
    jobCommitment: text("job_commitment"),
    terms: jsonb("terms").$type<Record<string, unknown>>().notNull(),
    revisionCount: integer("revision_count").default(0).notNull(),
    chainAuthoritative: boolean("chain_authoritative").default(true).notNull(),
    onChainTx: text("on_chain_tx"),
    contractAddress: text("contract_address"),
    contractEscrowId: text("contract_escrow_id"),
    deliveries: jsonb("deliveries").$type<Array<Record<string, unknown>>>().default([]),
    dispute: jsonb("dispute").$type<Record<string, unknown>>(),
    fundedAt: timestamp("funded_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("escrows_client_idx").on(table.client),
    index("escrows_provider_idx").on(table.provider),
    index("escrows_status_idx").on(table.status),
  ],
);

export const chainJobs = pgTable(
  "chain_jobs",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    status: chainJobStatusEnum("status").default("queued").notNull(),
    agentId: text("agent_id"),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    txHash: text("tx_hash"),
    contractAddress: text("contract_address"),
    error: text("error"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("chain_jobs_idempotency_idx").on(table.idempotencyKey),
    index("chain_jobs_status_idx").on(table.status),
  ],
);

export const chainEvents = pgTable(
  "chain_events",
  {
    id: text("id").primaryKey(),
    contractAddress: text("contract_address").notNull(),
    eventName: text("event_name").notNull(),
    txHash: text("tx_hash").notNull(),
    blockHeight: text("block_height"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chain_events_contract_idx").on(table.contractAddress),
    index("chain_events_tx_idx").on(table.txHash),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    fromAgentId: text("from_agent_id"),
    toAgentId: text("to_agent_id"),
    amount: text("amount").notNull(),
    asset: text("asset").notNull(),
    network: text("network").notNull(),
    txHash: text("tx_hash"),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("ledger_entries_created_idx").on(table.createdAt)],
);

export const artifacts = pgTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").references(() => jobs.id),
    escrowId: text("escrow_id"),
    uploaderAgentId: text("uploader_agent_id").notNull(),
    direction: text("direction").notNull(),
    contentHash: text("content_hash").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes").notNull(),
    encrypted: boolean("encrypted").default(true).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("artifacts_job_idx").on(table.jobId),
    index("artifacts_escrow_idx").on(table.escrowId),
  ],
);

export const messageEnvelopes = pgTable(
  "message_envelopes",
  {
    id: text("id").primaryKey(),
    fromAgent: text("from_agent").notNull(),
    toAgent: text("to_agent").notNull(),
    deviceId: integer("device_id").default(1).notNull(),
    type: text("type").notNull(),
    body: text("body").notNull(),
    signal: jsonb("signal").$type<Record<string, unknown>>(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("message_envelopes_to_idx").on(table.toAgent),
    index("message_envelopes_from_idx").on(table.fromAgent),
  ],
);

export const keyBundles = pgTable(
  "key_bundles",
  {
    agentId: text("agent_id").primaryKey(),
    identityKey: text("identity_key").notNull(),
    signedPreKey: jsonb("signed_pre_key").$type<Record<string, unknown>>().notNull(),
    oneTimePreKeys: jsonb("one_time_pre_keys")
      .$type<Array<Record<string, unknown>>>()
      .default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const inboxItems = pgTable(
  "inbox_items",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    status: text("status").default("unread").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [index("inbox_items_agent_idx").on(table.agentId)],
);

export const reputationEvents = pgTable(
  "reputation_events",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id").notNull(),
    kind: text("kind").notNull(),
    delta: integer("delta").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    txHash: text("tx_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("reputation_events_agent_idx").on(table.agentId)],
);

export const authNonces = pgTable(
  "auth_nonces",
  {
    nonce: text("nonce").primaryKey(),
    usedAt: timestamp("used_at", { withTimezone: true }).defaultNow().notNull(),
  },
);

export const bounties = pgTable(
  "bounties",
  {
    bountyId: text("bounty_id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    rewardAmount: text("reward_amount").notNull(),
    asset: text("asset").default("USDC").notNull(),
    creator: text("creator").notNull(),
    status: text("status").default("open").notNull(),
    winnerSubmissionId: text("winner_submission_id"),
    thumbnailUrl: text("thumbnail_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("bounties_creator_idx").on(table.creator),
    index("bounties_status_idx").on(table.status),
  ],
);

export const bountySubmissions = pgTable(
  "bounty_submissions",
  {
    submissionId: text("submission_id").primaryKey(),
    bountyId: text("bounty_id")
      .notNull()
      .references(() => bounties.bountyId),
    submitter: text("submitter").notNull(),
    url: text("url").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("bounty_submissions_bounty_idx").on(table.bountyId),
    index("bounty_submissions_submitter_idx").on(table.submitter),
  ],
);

export const bountyComments = pgTable(
  "bounty_comments",
  {
    commentId: text("comment_id").primaryKey(),
    bountyId: text("bounty_id")
      .notNull()
      .references(() => bounties.bountyId),
    author: text("author").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("bounty_comments_bounty_idx").on(table.bountyId)],
);
