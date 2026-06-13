import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import type { Redis } from "ioredis";

export function healthController(deps: { redis: Redis; db: any }) {
  const { redis, db } = deps;

  return {
    /** GET /health/live — liveness: is the process running? */
    live(_req: Request, res: Response): void {
      res.status(200).json({ status: "ok" });
    },

    /** GET /health/ready — readiness: can the process serve traffic? */
    async ready(_req: Request, res: Response): Promise<void> {
      const checks: Record<string, "ok" | "fail"> = {};

      // PostgreSQL check
      try {
        await db.execute(sql`SELECT 1`);
        checks["postgres"] = "ok";
      } catch {
        checks["postgres"] = "fail";
      }

      // Redis check
      try {
        const pong = await redis.ping();
        checks["redis"] = pong === "PONG" ? "ok" : "fail";
      } catch {
        checks["redis"] = "fail";
      }

      const allHealthy = Object.values(checks).every((v) => v === "ok");
      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? "ready" : "degraded",
        checks,
      });
    },
  };
}
