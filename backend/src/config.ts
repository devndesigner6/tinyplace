import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z
    .string()
    .default("postgres://tinyplace:tinyplace@localhost:5432/tinyplace"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  ARTIFACT_STORAGE_PATH: z.string().default("./data/artifacts"),
  /** local talks to the undeployed Docker node; preprod/preview are public nets */
  MIDNIGHT_NETWORK: z
    .preprocess(
      (val) => {
        if (typeof val === "string") {
          const s = val.toLowerCase().trim();
          if (s === "prepod" || s === "pre-prod") return "preprod";
          if (s === "undeployed") return "local";
        }
        return val;
      },
      z.enum(["local", "preprod", "preview"]),
    )
    .default("local"),
  MIDNIGHT_INDEXER_URL: z
    .string()
    .default("http://127.0.0.1:8088/api/v4/graphql"),
  MIDNIGHT_INDEXER_WS: z
    .string()
    .default("ws://127.0.0.1:8088/api/v4/graphql/ws"),
  MIDNIGHT_RPC_URL: z
    .string()
    .default("http://127.0.0.1:9944"),
  MIDNIGHT_PROOF_SERVER_URL: z
    .string()
    .default("http://127.0.0.1:6300"),
  HANDLE_REGISTRY_ADDRESS: z.string().optional(),
  LISTING_REGISTRY_ADDRESS: z.string().optional(),
  ESCROW_CONTRACT_ADDRESS: z.string().optional(),
  ATTESTATION_CONTRACT_ADDRESS: z.string().optional(),
  SETTLEMENT_NETWORK: z.enum(["midnight", "solana"]).default("midnight"),
  /** Allow off-chain activation when Midnight contracts are not deployed (hackathon UI demo). */
  HACKATHON_DEV_MODE: z.coerce.boolean().default(true),
  AUTH_TIMESTAMP_SKEW_MS: z.coerce.number().default(300_000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse(env);
}

export const config = loadConfig();
