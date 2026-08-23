import { Hono } from "hono";

export const feedRoutes = new Hono();

/**
 * The current backend clone does not yet persist social posts, but the SDK and
 * public web app expect this route to exist. Returning the canonical empty shape
 * lets the UI show an empty feed instead of an endless loading/error state.
 */
feedRoutes.get("/feed/home", (c) =>
  c.json({
    items: [],
    count: 0,
    nextCursor: null,
    note: "No feed posts are available in this deployment yet.",
  }),
);
