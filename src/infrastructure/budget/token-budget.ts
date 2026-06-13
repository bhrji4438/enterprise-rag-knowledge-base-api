import type { Redis } from "ioredis";
import type { TokenBudgetPolicy } from "../llm/llm-facade.js";
import { ProblemDetailsError } from "../../shared/errors/problem-details.js";

const USAGE_PREFIX = "token_usage:";

/**
 * Redis-backed TokenBudgetPolicy.
 *
 * Usage is tracked with monthly Redis counters (INCRBY).
 * Key pattern: `token_usage:{tenantId}:{YYYY-MM}`
 *
 * NOTE: For production, reconcile against the `llm_usage` PostgreSQL table.
 * Redis counters are fast but volatile — use as a hot cache enforcer only.
 */
export class RedisTokenBudgetPolicy implements TokenBudgetPolicy {
  constructor(
    private readonly redis: Redis,
    private readonly monthlyBudget: number
  ) {}

  private currentMonthKey(tenantId: string): string {
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    return `${USAGE_PREFIX}${tenantId}:${month}`;
  }

  async assertWithinBudget(input: {
    tenantId: string;
    estimatedTokens: number;
  }): Promise<void> {
    const key = this.currentMonthKey(input.tenantId);
    const used = parseInt((await this.redis.get(key)) ?? "0", 10);

    if (used + input.estimatedTokens > this.monthlyBudget) {
      throw new ProblemDetailsError({
        status: 402,
        title: "Token budget exceeded",
        type: "https://ragkb.dev/problems/budget-exceeded",
        detail: `Tenant ${input.tenantId} has used ${used} / ${this.monthlyBudget} tokens this month.`,
      });
    }
  }

  async recordUsage(input: {
    tenantId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }): Promise<void> {
    const key = this.currentMonthKey(input.tenantId);
    const totalTokens = input.inputTokens + input.outputTokens;
    // Expire counter 35 days after creation (covers full month + buffer)
    await this.redis.incrby(key, totalTokens);
    await this.redis.expire(key, 35 * 24 * 60 * 60);

    // Structured log for audit / reconciliation
    console.info("[usage]", {
      tenantId: input.tenantId,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      costUsd: input.costUsd,
    });
  }
}
