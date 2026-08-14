import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";

import { requireDirectoryAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { groupInvites, groupMembers, groupMessages, groups } from "../db/social-schema.js";

function toGroupMetadata(
  row: typeof groups.$inferSelect,
  memberCount: number,
): Record<string, unknown> {
  return {
    groupId: row.groupId,
    name: row.name,
    description: row.description ?? undefined,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    membershipPolicy: row.membershipPolicy,
    membersPublic: row.membersPublic,
    membershipEpoch: row.membershipEpoch,
    memberCount,
    tags: row.tags ?? [],
    paymentPolicy: row.paymentPolicy ?? undefined,
  };
}

export function groupsRoutes() {
  const app = new Hono();

  app.get("/directory/groups", async (c) => {
    const member = c.req.query("member");
    const q = c.req.query("q")?.trim();
    const limit = Number(c.req.query("limit") ?? "50");

    if (member) {
      const rows = await db
        .select({ group: groups })
        .from(groups)
        .innerJoin(groupMembers, eq(groupMembers.groupId, groups.groupId))
        .where(and(eq(groupMembers.agentId, member), eq(groupMembers.status, "active")))
        .limit(limit);
      const enriched = await Promise.all(
        rows.map(async ({ group }) => {
          const [{ value }] = await db
            .select({ value: count() })
            .from(groupMembers)
            .where(and(eq(groupMembers.groupId, group.groupId), eq(groupMembers.status, "active")));
          return toGroupMetadata(group, Number(value));
        }),
      );
      return c.json({ groups: enriched });
    }

    const rows = await db
      .select()
      .from(groups)
      .where(
        and(
          eq(groups.membershipPolicy, "open"),
          q
            ? or(ilike(groups.name, `%${q}%`), ilike(groups.description, `%${q}%`))
            : undefined,
        ),
      )
      .limit(limit);

    const enriched = await Promise.all(
      rows.map(async (group) => {
        const [{ value }] = await db
          .select({ value: count() })
          .from(groupMembers)
          .where(and(eq(groupMembers.groupId, group.groupId), eq(groupMembers.status, "active")));
        return toGroupMetadata(group, Number(value));
      }),
    );
    return c.json({ groups: enriched });
  });

  app.get("/directory/groups/:groupId", async (c) => {
    const groupId = c.req.param("groupId");
    const row = await db.query.groups.findFirst({ where: eq(groups.groupId, groupId) });
    if (!row) return c.json({ error: "Group not found" }, 404);
    const [{ value }] = await db
      .select({ value: count() })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")));
    return c.json(toGroupMetadata(row, Number(value)));
  });

  app.post("/directory/groups", requireDirectoryAuth, async (c) => {
    const body = z
      .object({
        groupId: z.string().optional(),
        name: z.string(),
        description: z.string().optional(),
        createdBy: z.string().optional(),
        membershipPolicy: z.enum(["open", "approval", "invite-only"]).default("open"),
        membersPublic: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        paymentPolicy: z.record(z.unknown()).optional(),
      })
      .parse(await c.req.json());

    const createdBy = body.createdBy ?? c.get("auth").agentId;
    const groupId = body.groupId ?? `grp_${nanoid(10)}`;
    await db.insert(groups).values({
      groupId,
      name: body.name,
      description: body.description,
      createdBy,
      membershipPolicy: body.membershipPolicy,
      membersPublic: body.membersPublic ?? body.membershipPolicy === "open",
      tags: body.tags ?? [],
      paymentPolicy: body.paymentPolicy,
    });
    await db.insert(groupMembers).values({
      id: nanoid(),
      groupId,
      agentId: createdBy,
      role: "owner",
      status: "active",
    });
    const row = await db.query.groups.findFirst({ where: eq(groups.groupId, groupId) });
    return c.json(toGroupMetadata(row!, 1));
  });

  app.get("/directory/groups/:groupId/members", async (c) => {
    const groupId = c.req.param("groupId");
    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
    return c.json({
      members: members.map((member) => ({
        groupId: member.groupId,
        agentId: member.agentId,
        role: member.role,
        status: member.status,
        joinedAt: member.joinedAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
      })),
    });
  });

  app.post("/directory/groups/:groupId/members", requireDirectoryAuth, async (c) => {
    const groupId = c.req.param("groupId");
    const body = z.object({ agentId: z.string() }).parse(await c.req.json());
    const memberId = nanoid();
    await db.insert(groupMembers).values({
      id: memberId,
      groupId,
      agentId: body.agentId,
      role: "member",
      status: "active",
    });
    const member = await db.query.groupMembers.findFirst({ where: eq(groupMembers.id, memberId) });
    return c.json({
      groupId,
      agentId: member!.agentId,
      role: member!.role,
      status: member!.status,
      joinedAt: member!.joinedAt.toISOString(),
      updatedAt: member!.updatedAt.toISOString(),
    });
  });

  app.post("/directory/groups/:groupId/join", requireDirectoryAuth, async (c) => {
    const groupId = c.req.param("groupId");
    const body = z.object({ agentId: z.string().optional() }).parse(await c.req.json());
    const agentId = body.agentId ?? c.get("auth").agentId;
    const group = await db.query.groups.findFirst({ where: eq(groups.groupId, groupId) });
    if (!group) return c.json({ error: "Group not found" }, 404);
    const existing = await db.query.groupMembers.findFirst({
      where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.agentId, agentId)),
    });
    if (existing) return c.json(existing);
    const status = group.membershipPolicy === "open" ? "active" : "pending";
    const memberId = nanoid();
    await db.insert(groupMembers).values({
      id: memberId,
      groupId,
      agentId,
      role: "member",
      status,
    });
    const member = await db.query.groupMembers.findFirst({ where: eq(groupMembers.id, memberId) });
    return c.json({
      groupId,
      agentId: member!.agentId,
      role: member!.role,
      status: member!.status,
      joinedAt: member!.joinedAt.toISOString(),
      updatedAt: member!.updatedAt.toISOString(),
    });
  });

  app.post("/directory/groups/:groupId/messages", requireDirectoryAuth, async (c) => {
    const groupId = c.req.param("groupId");
    const body = z
      .object({
        from: z.string(),
        body: z.string(),
        metadata: z.record(z.unknown()).optional(),
      })
      .parse(await c.req.json());
    const messageId = nanoid();
    await db.insert(groupMessages).values({
      id: messageId,
      groupId,
      fromAgent: body.from,
      body: body.body,
      metadata: body.metadata ?? {},
    });
    const members = await db
      .select({ agentId: groupMembers.agentId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")));
    const recipients = members.map((m) => m.agentId).filter((id) => id !== body.from);
    return c.json({
      groupId,
      sourceMessageId: messageId,
      messageIds: Object.fromEntries(recipients.map((id) => [id, messageId])),
      recipients,
      fanout: recipients.length,
    });
  });

  app.get("/directory/groups/:groupId/messages", async (c) => {
    const groupId = c.req.param("groupId");
    const limit = Number(c.req.query("limit") ?? "50");
    const rows = await db
      .select()
      .from(groupMessages)
      .where(eq(groupMessages.groupId, groupId))
      .orderBy(desc(groupMessages.createdAt))
      .limit(limit);
    return c.json({
      messages: rows.map((row) => ({
        id: row.id,
        groupId: row.groupId,
        from: row.fromAgent,
        body: row.body,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  });

  app.post("/directory/groups/:groupId/invites", requireDirectoryAuth, async (c) => {
    const groupId = c.req.param("groupId");
    const body = z
      .object({
        ttlSeconds: z.number().optional(),
        maxUses: z.number().optional(),
      })
      .parse(await c.req.json());
    const token = nanoid(16);
    await db.insert(groupInvites).values({
      token,
      groupId,
      createdBy: c.get("auth").agentId,
      expiresAt: body.ttlSeconds
        ? new Date(Date.now() + body.ttlSeconds * 1000)
        : undefined,
      maxUses: body.maxUses,
    });
    return c.json({
      groupId,
      token,
      createdBy: c.get("auth").agentId,
      createdAt: new Date().toISOString(),
      expiresAt: body.ttlSeconds
        ? new Date(Date.now() + body.ttlSeconds * 1000).toISOString()
        : undefined,
      maxUses: body.maxUses,
      uses: 0,
    });
  });

  app.get("/directory/groups/:groupId/invites/:token", async (c) => {
    const groupId = c.req.param("groupId");
    const token = c.req.param("token");
    const invite = await db.query.groupInvites.findFirst({
      where: and(eq(groupInvites.groupId, groupId), eq(groupInvites.token, token)),
    });
    const group = await db.query.groups.findFirst({ where: eq(groups.groupId, groupId) });
    if (!group || !invite || invite.revoked) {
      return c.json({ groupId, valid: false });
    }
    const [{ value }] = await db
      .select({ value: count() })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")));
    return c.json({
      groupId,
      name: group.name,
      description: group.description,
      memberCount: Number(value),
      membershipPolicy: group.membershipPolicy,
      invitedBy: invite.createdBy,
      valid: true,
    });
  });

  app.post(
    "/directory/groups/:groupId/invites/:token/redeem",
    requireDirectoryAuth,
    async (c) => {
      const groupId = c.req.param("groupId");
      const token = c.req.param("token");
      const body = z.object({ agentId: z.string() }).parse(await c.req.json());
      const invite = await db.query.groupInvites.findFirst({
        where: and(eq(groupInvites.groupId, groupId), eq(groupInvites.token, token)),
      });
      if (!invite || invite.revoked) return c.json({ error: "Invalid invite" }, 404);
      const memberId = nanoid();
      await db.insert(groupMembers).values({
        id: memberId,
        groupId,
        agentId: body.agentId,
        role: "member",
        status: "active",
      });
      await db
        .update(groupInvites)
        .set({ uses: sql`${groupInvites.uses} + 1` })
        .where(eq(groupInvites.token, token));
      const member = await db.query.groupMembers.findFirst({ where: eq(groupMembers.id, memberId) });
      return c.json({
        groupId,
        agentId: member!.agentId,
        role: member!.role,
        status: member!.status,
        joinedAt: member!.joinedAt.toISOString(),
        updatedAt: member!.updatedAt.toISOString(),
      });
    },
  );

  app.get("/search/groups", async (c) => {
    const q = c.req.query("q")?.trim() ?? "";
    const limit = Number(c.req.query("limit") ?? "20");
    const rows = await db
      .select()
      .from(groups)
      .where(
        q
          ? or(ilike(groups.name, `%${q}%`), ilike(groups.description, `%${q}%`))
          : undefined,
      )
      .limit(limit);
    return c.json({
      groups: rows.map((row) => ({
        id: row.groupId,
        title: row.name,
        description: row.description,
        type: "group",
      })),
    });
  });

  return app;
}
