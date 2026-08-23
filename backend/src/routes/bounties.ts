import { count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";

import { requireDirectoryAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { bounties, bountyComments, bountySubmissions } from "../db/schema.js";

export const bountiesRoutes = new Hono();

const bountyCreateSchema = z.object({
  bountyId: z.string().optional(),
  title: z.string().trim().min(1),
  description: z.string().trim(),
  amount: z.string().optional(),
  rewardAmount: z.string().optional(),
  asset: z.string().optional(),
  creator: z.string().optional(),
  creatorCryptoId: z.string().optional(),
  deadline: z.string().optional(),
  durationDays: z.coerce.number().int().min(1).max(31).optional(),
  thumbnailUrl: z.string().url().optional(),
  payment: z.record(z.string()).optional(),
});

type BountyRow = typeof bounties.$inferSelect;

function derivedDeadline(createdAt: Date): string {
  return new Date(createdAt.getTime() + 7 * 24 * 60 * 60_000).toISOString();
}

function toApiBounty(
  row: BountyRow,
  submissionCount = 0,
  commentCount = 0,
): Record<string, unknown> {
  const createdAt = row.createdAt.toISOString();
  return {
    bountyId: row.bountyId,
    creator: row.creator,
    title: row.title,
    description: row.description,
    reward: {
      amount: row.rewardAmount,
      asset: row.asset,
      network: "off-chain",
    },
    status: row.status,
    thumbnail: row.thumbnailUrl
      ? {
          width: 0,
          height: 0,
          mimeType: "image/*",
          size: 0,
          updatedAt: row.updatedAt.toISOString(),
        }
      : undefined,
    submissionCount,
    commentCount,
    winnerSubmissionId: row.winnerSubmissionId ?? undefined,
    startAt: createdAt,
    deadline: derivedDeadline(row.createdAt),
    createdAt,
    updatedAt: row.updatedAt.toISOString(),
    settlement: {
      mode: "off-chain",
      note: "Bounty data is stored by the API; Midnight escrow deployment is pending.",
    },
  };
}

async function countsFor(bountyId: string): Promise<{
  submissionCount: number;
  commentCount: number;
}> {
  const [submissionResult, commentResult] = await Promise.all([
    db
      .select({ value: count() })
      .from(bountySubmissions)
      .where(eq(bountySubmissions.bountyId, bountyId)),
    db
      .select({ value: count() })
      .from(bountyComments)
      .where(eq(bountyComments.bountyId, bountyId)),
  ]);
  return {
    submissionCount: Number(submissionResult[0]?.value ?? 0),
    commentCount: Number(commentResult[0]?.value ?? 0),
  };
}

async function apiBounty(row: BountyRow): Promise<Record<string, unknown>> {
  const counts = await countsFor(row.bountyId);
  return toApiBounty(row, counts.submissionCount, counts.commentCount);
}

// GET /bounties - List bounties
bountiesRoutes.get("/bounties", async (c) => {
  try {
    const creator = c.req.query("creator");
    const status = c.req.query("status");
    const parsedLimit = Number(c.req.query("limit") ?? 50);
    const parsedOffset = Number(c.req.query("offset") ?? 0);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 50)
      : 50;
    const offset = Number.isFinite(parsedOffset)
      ? Math.max(Math.trunc(parsedOffset), 0)
      : 0;

    let query = db.select().from(bounties);
    if (creator) {
      query = query.where(eq(bounties.creator, creator)) as typeof query;
    } else if (status) {
      query = query.where(eq(bounties.status, status)) as typeof query;
    }

    const rows = await query
      .orderBy(desc(bounties.createdAt))
      .limit(limit)
      .offset(offset);
    return c.json({
      bounties: await Promise.all(rows.map((row) => apiBounty(row))),
    });
  } catch (error) {
    console.error("Error listing bounties:", error);
    return c.json({ bounties: [] });
  }
});

// GET /bounties/:id - Get single bounty
bountiesRoutes.get("/bounties/:id", async (c) => {
  const bountyId = c.req.param("id") ?? "";
  const row = await db.query.bounties.findFirst({
    where: eq(bounties.bountyId, bountyId),
  });

  if (!row) {
    return c.json({ error: "Bounty not found", code: "NOT_FOUND" }, 404);
  }
  return c.json(await apiBounty(row));
});

// POST /bounties - Create the API-side bounty record. Midnight escrow funding
// remains a separate capability until the Preprod contracts are deployed.
bountiesRoutes.post("/bounties", requireDirectoryAuth, async (c) => {
  const body = bountyCreateSchema.parse(await c.req.json());
  const bountyId = body.bountyId || `bounty_${nanoid(12)}`;
  const creator = body.creator || c.get("auth").agentId;

  const newBounty = {
    bountyId,
    title: body.title,
    description: body.description,
    rewardAmount: body.rewardAmount || body.amount || "100",
    asset: body.asset || "USDC",
    creator,
    status: "open",
    thumbnailUrl: body.thumbnailUrl ?? null,
  };

  await db.insert(bounties).values(newBounty);
  const row = await db.query.bounties.findFirst({
    where: eq(bounties.bountyId, bountyId),
  });
  return c.json(
    {
      ...(await apiBounty(row!)),
      requestedDeadline: body.deadline,
      requestedDurationDays: body.durationDays,
    },
    201,
  );
});

// POST /bounties/:id/cancel - Cancel bounty
bountiesRoutes.post("/bounties/:id/cancel", requireDirectoryAuth, async (c) => {
  const bountyId = c.req.param("id") ?? "";
  const row = await db.query.bounties.findFirst({
    where: eq(bounties.bountyId, bountyId),
  });
  if (!row)
    return c.json({ error: "Bounty not found", code: "NOT_FOUND" }, 404);
  await db
    .update(bounties)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(bounties.bountyId, bountyId));
  const updated = await db.query.bounties.findFirst({
    where: eq(bounties.bountyId, bountyId),
  });
  return c.json(await apiBounty(updated!));
});

// GET /bounties/:id/submissions - List submissions
bountiesRoutes.get("/bounties/:id/submissions", async (c) => {
  const bountyId = c.req.param("id") ?? "";
  const items = await db
    .select()
    .from(bountySubmissions)
    .where(eq(bountySubmissions.bountyId, bountyId))
    .orderBy(desc(bountySubmissions.createdAt));
  return c.json({
    submissions: items.map((item) => ({
      submissionId: item.submissionId,
      bountyId: item.bountyId,
      submitter: item.submitter,
      url: item.url,
      note: item.notes ?? undefined,
      status: "submitted",
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.createdAt.toISOString(),
    })),
  });
});

async function createSubmission(c: Context) {
  const bountyId = c.req.param("id") ?? "";
  const body = z
    .object({
      submitter: z.string().optional(),
      submitterCryptoId: z.string().optional(),
      url: z.string().url(),
      title: z.string().optional(),
      note: z.string().optional(),
      notes: z.string().optional(),
    })
    .parse(await c.req.json());
  const bounty = await db.query.bounties.findFirst({
    where: eq(bounties.bountyId, bountyId),
  });
  if (!bounty)
    return c.json({ error: "Bounty not found", code: "NOT_FOUND" }, 404);
  const submissionId = `sub_${nanoid(12)}`;
  const submitter = body.submitter || c.get("auth").agentId;
  const created = await db
    .insert(bountySubmissions)
    .values({
      submissionId,
      bountyId,
      submitter,
      url: body.url,
      notes: body.note ?? body.notes,
    })
    .returning();
  const item = created[0];
  return c.json(
    {
      submissionId: item.submissionId,
      bountyId: item.bountyId,
      submitter: item.submitter,
      url: item.url,
      title: body.title,
      note: item.notes ?? undefined,
      status: "submitted",
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.createdAt.toISOString(),
    },
    201,
  );
}

// Both paths are supported: `/submissions` is the SDK path and `/submit` is
// retained for older agents already using the original API.
bountiesRoutes.post(
  "/bounties/:id/submissions",
  requireDirectoryAuth,
  createSubmission,
);
bountiesRoutes.post(
  "/bounties/:id/submit",
  requireDirectoryAuth,
  createSubmission,
);

// GET /bounties/:id/comments - List comments
bountiesRoutes.get("/bounties/:id/comments", async (c) => {
  const bountyId = c.req.param("id") ?? "";
  const items = await db
    .select()
    .from(bountyComments)
    .where(eq(bountyComments.bountyId, bountyId))
    .orderBy(desc(bountyComments.createdAt));
  return c.json({
    comments: items.map((item) => ({
      commentId: item.commentId,
      bountyId: item.bountyId,
      author: item.author,
      body: item.content,
      createdAt: item.createdAt.toISOString(),
    })),
  });
});

async function createComment(c: Context) {
  const bountyId = c.req.param("id") ?? "";
  const body = z
    .object({
      author: z.string().optional(),
      authorCryptoId: z.string().optional(),
      body: z.string().trim().min(1),
      content: z.string().optional(),
    })
    .parse(await c.req.json());
  const bounty = await db.query.bounties.findFirst({
    where: eq(bounties.bountyId, bountyId),
  });
  if (!bounty)
    return c.json({ error: "Bounty not found", code: "NOT_FOUND" }, 404);
  const commentId = `comment_${nanoid(12)}`;
  const created = await db
    .insert(bountyComments)
    .values({
      commentId,
      bountyId,
      author: body.author || c.get("auth").agentId,
      content: body.body || body.content || "",
    })
    .returning();
  const item = created[0];
  return c.json(
    {
      commentId: item.commentId,
      bountyId: item.bountyId,
      author: item.author,
      body: item.content,
      createdAt: item.createdAt.toISOString(),
    },
    201,
  );
}

// Both paths are supported: `/comments` is the SDK path and `/comment` is
// retained for older agents already using the original API.
bountiesRoutes.post(
  "/bounties/:id/comments",
  requireDirectoryAuth,
  createComment,
);
bountiesRoutes.post(
  "/bounties/:id/comment",
  requireDirectoryAuth,
  createComment,
);
