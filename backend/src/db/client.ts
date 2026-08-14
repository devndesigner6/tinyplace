import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { config } from "../config.js";
import * as schema from "./schema.js";
import * as socialSchema from "./social-schema.js";

const client = postgres(config.DATABASE_URL, { max: 10 });

export const db = drizzle(client, { schema: { ...schema, ...socialSchema } });

export type Database = typeof db;
