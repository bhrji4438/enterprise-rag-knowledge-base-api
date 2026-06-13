import { Redis } from "ioredis";

let _client: Redis | undefined;

/**
 * Returns a singleton IORedis client.
 * Uses the named export `Redis` to satisfy strict TypeScript ESM imports.
 */
export function createRedisClient(url: string): Redis {
  if (_client) return _client;

  _client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  _client.on("error", (err: Error) => {
    console.error("[redis] connection error:", err.message);
  });

  _client.on("connect", () => {
    console.info("[redis] connected");
  });

  return _client;
}

export type { Redis };
