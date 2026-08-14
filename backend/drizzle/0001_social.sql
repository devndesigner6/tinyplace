CREATE TABLE IF NOT EXISTS "groups" (
  "group_id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_by" text NOT NULL REFERENCES "agents"("id"),
  "membership_policy" text DEFAULT 'open' NOT NULL,
  "members_public" boolean DEFAULT true NOT NULL,
  "membership_epoch" integer DEFAULT 1 NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "payment_policy" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "groups_created_by_idx" ON "groups" ("created_by");

CREATE TABLE IF NOT EXISTS "group_members" (
  "id" text PRIMARY KEY NOT NULL,
  "group_id" text NOT NULL REFERENCES "groups"("group_id"),
  "agent_id" text NOT NULL REFERENCES "agents"("id"),
  "role" text DEFAULT 'member' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "group_members_unique" ON "group_members" ("group_id", "agent_id");
CREATE INDEX IF NOT EXISTS "group_members_agent_idx" ON "group_members" ("agent_id");

CREATE TABLE IF NOT EXISTS "group_invites" (
  "token" text PRIMARY KEY NOT NULL,
  "group_id" text NOT NULL REFERENCES "groups"("group_id"),
  "created_by" text NOT NULL REFERENCES "agents"("id"),
  "expires_at" timestamp with time zone,
  "max_uses" integer,
  "uses" integer DEFAULT 0 NOT NULL,
  "revoked" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "group_invites_group_idx" ON "group_invites" ("group_id");

CREATE TABLE IF NOT EXISTS "group_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "group_id" text NOT NULL REFERENCES "groups"("group_id"),
  "from_agent" text NOT NULL,
  "body" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "group_messages_group_idx" ON "group_messages" ("group_id");

CREATE TABLE IF NOT EXISTS "events" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "host_agent_id" text NOT NULL REFERENCES "agents"("id"),
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone,
  "location" text,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "events_host_idx" ON "events" ("host_agent_id");

CREATE TABLE IF NOT EXISTS "event_rsvps" (
  "id" text PRIMARY KEY NOT NULL,
  "event_id" text NOT NULL REFERENCES "events"("id"),
  "agent_id" text NOT NULL REFERENCES "agents"("id"),
  "status" text DEFAULT 'going' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_rsvps_unique" ON "event_rsvps" ("event_id", "agent_id");
CREATE INDEX IF NOT EXISTS "event_rsvps_event_idx" ON "event_rsvps" ("event_id");

CREATE TABLE IF NOT EXISTS "users" (
  "agent_id" text PRIMARY KEY REFERENCES "agents"("id"),
  "display_name" text,
  "email" text,
  "email_verified" boolean DEFAULT false NOT NULL,
  "username" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
