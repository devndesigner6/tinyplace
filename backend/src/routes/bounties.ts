import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "../db/client.js";
import { bounties, bountySubmissions, bountyComments } from "../db/schema.js";

export const bountiesRoutes = new Hono();

// GET /bounties - List bounties
bountiesRoutes.get("/bounties", async (c) => {
  try {
    const creator = c.req.query("creator");
    const status = c.req.query("status");

    let query = db.select().from(bounties);
    if (creator) {
      query = query.where(eq(bounties.creator, creator)) as typeof query;
    } else if (status) {
      query = query.where(eq(bounties.status, status)) as typeof query;
    }

    const items = await query.orderBy(desc(bounties.createdAt)).limit(50);
    return c.json({ bounties: items });
  } catch (error) {
    console.error("Error listing bounties:", error);
    return c.json({ bounties: [] });
  }
});

// GET /bounties/:id - Get single bounty
bountiesRoutes.get("/bounties/:id", async (c) => {
  const bountyId = c.req.param("id");
  const result = await db
    .select()
    .from(bounties)
    .where(eq(bounties.bountyId, bountyId))
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Bounty not found", code: "NOT_FOUND" }, 404);
  }
  return c.json(result[0]);
});

// POST /bounties - Create bounty
bountiesRoutes.post("/bounties", async (c) => {
  const body = await c.req.json();
  const bountyId = body.bountyId || `bounty_${nanoid(12)}`;

  const newBounty = {
    bountyId,
    title: body.title || "Untitled Bounty",
    description: body.description || "",
    rewardAmount: String(body.rewardAmount || body.amount || "100"),
    asset: body.asset || "USDC",
    creator: body.creator || c.req.header("X-Agent-ID") || "agent_anon",
    status: "open",
    thumbnailUrl: body.thumbnailUrl || null,
  };

  await db.insert(bounties).values(newBounty);
  return c.json(newBounty, 201);
});

// POST /bounties/:id/cancel - Cancel bounty
bountiesRoutes.post("/bounties/:id/cancel", async (c) => {
  const bountyId = c.req.param("id");
  await db
    .update(bounties)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(bounties.bountyId, bountyId));
  return c.json({ success: true, bountyId });
});

// GET /bounties/:id/submissions - List submissions
bountiesRoutes.get("/bounties/:id/submissions", async (c) => {
  const bountyId = c.req.param("id");
  const items = await db
    .select()
    .from(bountySubmissions)
    .where(eq(bountySubmissions.bountyId, bountyId))
    .orderBy(desc(bountySubmissions.createdAt));
  return c.json({ submissions: items });
});

// POST /bounties/:id/submit - Submit work
bountiesRoutes.post("/bounties/:id/submit", async (c) => {
  const bountyId = c.req.param("id");
  const body = await c.req.json();
  const submissionId = `sub_${nanoid(12)}`;

  const newSubmission = {
    submissionId,
    bountyId,
    submitter: body.submitter || c.req.header("X-Agent-ID") || "agent_anon",
    url: body.url || "",
    notes: body.notes || "",
  };

  await db.insert(bountySubmissions).values(newSubmission);
  return c.json(newSubmission, 201);
});

// GET /bounties/:id/comments - List comments
bountiesRoutes.get("/bounties/:id/comments", async (c) => {
  const bountyId = c.req.param("id");
  const items = await db
    .select()
    .from(bountyComments)
    .where(eq(bountyComments.bountyId, bountyId))
    .orderBy(desc(bountyComments.createdAt));
  return c.json({ comments: items });
});

// POST /bounties/:id/comment - Post comment
bountiesRoutes.post("/bounties/:id/comment", async (c) => {
  const bountyId = c.req.param("id");
  const body = await c.req.json();
  const commentId = `comment_${nanoid(12)}`;

  const newComment = {
    commentId,
    bountyId,
    author: body.author || c.req.header("X-Agent-ID") || "agent_anon",
    content: body.content || "",
  };

  await db.insert(bountyComments).values(newComment);
  return c.json(newComment, 201);
});
