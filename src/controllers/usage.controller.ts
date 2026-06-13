import type { Request, Response } from "express";
import type { Redis } from "ioredis";

const USAGE_PREFIX = "token_usage:";

export function usageController(deps: { redis: Redis; monthlyBudget: number }) {
  const { redis, monthlyBudget } = deps;

  return {
    /** GET /v1/usage — tenant token and cost usage metrics */
    async getUsage(_req: Request, res: Response): Promise<void> {
      const tenantId = res.locals["tenantId"] as string;
      const now = new Date();
      const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const key = `${USAGE_PREFIX}${tenantId}:${month}`;

      const rawUsed = await redis.get(key);
      const tokensUsed = rawUsed ? parseInt(rawUsed, 10) : 0;

      // Approximate cost — $0.15/1M tokens (gpt-4o-mini blended rate)
      const costUsd = parseFloat(((tokensUsed * 0.15) / 1_000_000).toFixed(4));

      res.status(200).json({
        tenantId,
        monthlyBudget,
        tokensUsed,
        costUsd,
        period: month,
        // TODO: add real cacheHitRate from Redis HITRATE or prom-client counter
        cacheHitRate: null,
      });
    },
  };
}
