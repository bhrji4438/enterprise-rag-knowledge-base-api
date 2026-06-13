import type { Redis } from "ioredis";
import type { PromptCache } from "../llm/llm-facade.js";
import type { LlmResponse } from "../llm/llm-provider.js";

const CACHE_PREFIX = "prompt_cache:";

/**
 * Redis-backed PromptCache.
 * Keys are namespaced with a prefix to avoid collisions with BullMQ keys.
 * Serialises LlmResponse as JSON.
 */
export class RedisPromptCache implements PromptCache {
  constructor(
    private readonly redis: Redis,
    private readonly defaultTtlSeconds: number
  ) {}

  async get(key: string): Promise<LlmResponse | null> {
    const raw = await this.redis.get(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LlmResponse;
    } catch {
      return null;
    }
  }

  async set(key: string, value: LlmResponse, ttlSeconds: number): Promise<void> {
    const ttl = ttlSeconds > 0 ? ttlSeconds : this.defaultTtlSeconds;
    await this.redis.setex(`${CACHE_PREFIX}${key}`, ttl, JSON.stringify(value));
  }
}
