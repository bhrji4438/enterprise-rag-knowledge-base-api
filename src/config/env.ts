import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  // ── Authentication ──────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  // ── LLM / AI ────────────────────────────────────────────────────────────────
  USE_MOCKS: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_CHAT_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-large"),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  // ── Retrieval / Chunking ─────────────────────────────────────────────────────
  DEFAULT_TOP_K: z.coerce.number().int().min(1).max(30).default(8),
  MAX_CHUNK_TOKENS: z.coerce.number().int().min(200).max(2000).default(800),
  CHUNK_OVERLAP_TOKENS: z.coerce.number().int().min(20).max(400).default(120),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(3072),
  // ── Cost & Budget ────────────────────────────────────────────────────────────
  TENANT_MONTHLY_TOKEN_BUDGET: z.coerce.number().int().positive().default(5_000_000),
  PROMPT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  // ── Security / Rate limiting ─────────────────────────────────────────────────
  ALLOWED_ORIGINS: z.string().default(""),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  // ── Observability ────────────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  METRICS_ENABLED: z.preprocess((v) => v === "true" || v === true, z.boolean()).default(false),
});

export type AppConfig = z.infer<typeof schema>;

// Singleton: parse once, reuse everywhere
let _config: AppConfig | undefined;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  if (_config) return _config;
  _config = schema.parse(source);
  return _config;
}
