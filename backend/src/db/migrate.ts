import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { config } from "../config.js";
import { db } from "./client.js";

async function main(): Promise<void> {
  const migrationClient = postgres(config.DATABASE_URL, { max: 1 });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await migrationClient.end();
  console.log("Migrations applied.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
