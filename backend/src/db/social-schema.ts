import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { agents } from "./schema.js";

export const groups = pgTable(
  "groups",
  {
    groupId: text("group_id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: text("created_by")
      .notNull()
      .references(() => agents.id),
    membershipPolicy: text("membership_policy").notNull().default("open"),
    membersPublic: boolean("members_public").default(true).notNull(),
    membershipEpoch: integer("membership_epoch").default(1).notNull(),
    tags: jsonb("tags").$type<Array<string>>().default([]),
    paymentPolicy: jsonb("payment_policy").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("groups_created_by_idx").on(table.createdBy)],
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.groupId),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("group_members_unique").on(table.groupId, table.agentId),
    index("group_members_agent_idx").on(table.agentId),
  ],
);

export const groupInvites = pgTable(
  "group_invites",
  {
    token: text("token").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.groupId),
    createdBy: text("created_by")
      .notNull()
      .references(() => agents.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    uses: integer("uses").default(0).notNull(),
    revoked: boolean("revoked").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("group_invites_group_idx").on(table.groupId)],
);

export const groupMessages = pgTable(
  "group_messages",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.groupId),
    fromAgent: text("from_agent").notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("group_messages_group_idx").on(table.groupId)],
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    hostAgentId: text("host_agent_id")
      .notNull()
      .references(() => agents.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    location: text("location"),
    tags: jsonb("tags").$type<Array<string>>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("events_host_idx").on(table.hostAgentId)],
);

export const eventRsvps = pgTable(
  "event_rsvps",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    status: text("status").notNull().default("going"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("event_rsvps_unique").on(table.eventId, table.agentId),
    index("event_rsvps_event_idx").on(table.eventId),
  ],
);

export const users = pgTable("users", {
  agentId: text("agent_id")
    .primaryKey()
    .references(() => agents.id),
  displayName: text("display_name"),
  email: text("email"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  username: text("username"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
