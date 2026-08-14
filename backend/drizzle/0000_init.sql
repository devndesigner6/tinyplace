CREATE TYPE "public"."handle_status" AS ENUM('pending_chain', 'active', 'expired', 'transferred', 'deactivated');
CREATE TYPE "public"."chain_job_status" AS ENUM('queued', 'preparing', 'proving', 'submitted', 'observed', 'finalized', 'retryable_failure', 'permanent_failure');
CREATE TYPE "public"."escrow_status" AS ENUM('created', 'pending_fund', 'funded', 'accepted', 'delivered', 'revision_requested', 'accepted_delivery', 'released', 'disputed', 'resolved', 'refunded', 'expired', 'cancelled');
CREATE TYPE "public"."job_status" AS ENUM('draft', 'awaiting_fund', 'open', 'in_progress', 'delivered', 'completed', 'disputed', 'cancelled');

CREATE TABLE "agents" (
  "id" text PRIMARY KEY NOT NULL,
  "public_key_base64" text NOT NULL,
  "midnight_address" text,
  "actor_type" text DEFAULT 'agent' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "agents_public_key_idx" ON "agents" ("public_key_base64");

CREATE TABLE "handles" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "agent_id" text NOT NULL REFERENCES "agents"("id"),
  "status" "handle_status" DEFAULT 'pending_chain' NOT NULL,
  "profile_version_hash" text,
  "owner_commitment" text,
  "chain_tx_hash" text,
  "contract_address" text,
  "registered_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "handles_name_idx" ON "handles" ("name");
CREATE INDEX "handles_agent_idx" ON "handles" ("agent_id");

CREATE TABLE "profiles" (
  "agent_id" text PRIMARY KEY REFERENCES "agents"("id"),
  "display_name" text,
  "bio" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "version" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "directory_cards" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL REFERENCES "agents"("id"),
  "handle" text,
  "card" jsonb NOT NULL,
  "skill_md" text,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "directory_cards_agent_idx" ON "directory_cards" ("agent_id");
CREATE INDEX "directory_cards_handle_idx" ON "directory_cards" ("handle");

CREATE TABLE "listings" (
  "id" text PRIMARY KEY NOT NULL,
  "seller_agent_id" text NOT NULL REFERENCES "agents"("id"),
  "title" text NOT NULL,
  "description" text NOT NULL,
  "category" text,
  "price_amount" text NOT NULL,
  "price_asset" text NOT NULL,
  "price_network" text DEFAULT 'midnight:preprod' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "listings_seller_idx" ON "listings" ("seller_agent_id");

CREATE TABLE "listing_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "listing_id" text NOT NULL REFERENCES "listings"("id"),
  "version" integer NOT NULL,
  "content_hash" text NOT NULL,
  "chain_commitment_tx" text,
  "chain_anchored" boolean DEFAULT false NOT NULL,
  "snapshot" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "listing_versions_unique" ON "listing_versions" ("listing_id", "version");

CREATE TABLE "jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "listing_version_id" text NOT NULL REFERENCES "listing_versions"("id"),
  "buyer_agent_id" text NOT NULL REFERENCES "agents"("id"),
  "seller_agent_id" text NOT NULL REFERENCES "agents"("id"),
  "status" "job_status" DEFAULT 'draft' NOT NULL,
  "job_commitment" text NOT NULL,
  "escrow_id" text,
  "deadline" timestamp with time zone,
  "privacy_requirements" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "jobs_buyer_idx" ON "jobs" ("buyer_agent_id");
CREATE INDEX "jobs_seller_idx" ON "jobs" ("seller_agent_id");

CREATE TABLE "escrows" (
  "escrow_id" text PRIMARY KEY NOT NULL,
  "job_id" text REFERENCES "jobs"("id"),
  "status" "escrow_status" DEFAULT 'created' NOT NULL,
  "client" text NOT NULL,
  "client_crypto_id" text,
  "provider" text NOT NULL,
  "provider_crypto_id" text,
  "amount" text NOT NULL,
  "asset" text NOT NULL,
  "network" text NOT NULL,
  "listing_version_hash" text,
  "job_commitment" text,
  "terms" jsonb NOT NULL,
  "revision_count" integer DEFAULT 0 NOT NULL,
  "chain_authoritative" boolean DEFAULT true NOT NULL,
  "on_chain_tx" text,
  "contract_address" text,
  "contract_escrow_id" text,
  "deliveries" jsonb DEFAULT '[]'::jsonb,
  "dispute" jsonb,
  "funded_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "escrows_client_idx" ON "escrows" ("client");
CREATE INDEX "escrows_provider_idx" ON "escrows" ("provider");
CREATE INDEX "escrows_status_idx" ON "escrows" ("status");

CREATE TABLE "chain_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "status" "chain_job_status" DEFAULT 'queued' NOT NULL,
  "agent_id" text,
  "resource_type" text,
  "resource_id" text,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "tx_hash" text,
  "contract_address" text,
  "error" text,
  "idempotency_key" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finalized_at" timestamp with time zone
);
CREATE UNIQUE INDEX "chain_jobs_idempotency_idx" ON "chain_jobs" ("idempotency_key");
CREATE INDEX "chain_jobs_status_idx" ON "chain_jobs" ("status");

CREATE TABLE "chain_events" (
  "id" text PRIMARY KEY NOT NULL,
  "contract_address" text NOT NULL,
  "event_name" text NOT NULL,
  "tx_hash" text NOT NULL,
  "block_height" text,
  "payload" jsonb NOT NULL,
  "observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "chain_events_contract_idx" ON "chain_events" ("contract_address");
CREATE INDEX "chain_events_tx_idx" ON "chain_events" ("tx_hash");

CREATE TABLE "ledger_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "from_agent_id" text,
  "to_agent_id" text,
  "amount" text NOT NULL,
  "asset" text NOT NULL,
  "network" text NOT NULL,
  "tx_hash" text,
  "resource_type" text,
  "resource_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "ledger_entries_created_idx" ON "ledger_entries" ("created_at");

CREATE TABLE "artifacts" (
  "id" text PRIMARY KEY NOT NULL,
  "job_id" text REFERENCES "jobs"("id"),
  "escrow_id" text,
  "uploader_agent_id" text NOT NULL,
  "direction" text NOT NULL,
  "content_hash" text NOT NULL,
  "storage_key" text NOT NULL,
  "mime_type" text,
  "size_bytes" integer NOT NULL,
  "encrypted" boolean DEFAULT true NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "artifacts_job_idx" ON "artifacts" ("job_id");
CREATE INDEX "artifacts_escrow_idx" ON "artifacts" ("escrow_id");

CREATE TABLE "message_envelopes" (
  "id" text PRIMARY KEY NOT NULL,
  "from_agent" text NOT NULL,
  "to_agent" text NOT NULL,
  "device_id" integer DEFAULT 1 NOT NULL,
  "type" text NOT NULL,
  "body" text NOT NULL,
  "signal" jsonb,
  "timestamp" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "message_envelopes_to_idx" ON "message_envelopes" ("to_agent");
CREATE INDEX "message_envelopes_from_idx" ON "message_envelopes" ("from_agent");

CREATE TABLE "key_bundles" (
  "agent_id" text PRIMARY KEY NOT NULL,
  "identity_key" text NOT NULL,
  "signed_pre_key" jsonb NOT NULL,
  "one_time_pre_keys" jsonb DEFAULT '[]'::jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "inbox_items" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "status" text DEFAULT 'unread' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "read_at" timestamp with time zone
);
CREATE INDEX "inbox_items_agent_idx" ON "inbox_items" ("agent_id");

CREATE TABLE "reputation_events" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL,
  "kind" text NOT NULL,
  "delta" integer NOT NULL,
  "resource_type" text,
  "resource_id" text,
  "tx_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "reputation_events_agent_idx" ON "reputation_events" ("agent_id");

CREATE TABLE "auth_nonces" (
  "nonce" text PRIMARY KEY NOT NULL,
  "used_at" timestamp with time zone DEFAULT now() NOT NULL
);
