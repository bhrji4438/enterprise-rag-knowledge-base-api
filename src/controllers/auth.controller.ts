import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { loadConfig } from "../config/env.js";

const TokenRequestSchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["owner", "admin", "engineer", "viewer", "service_account"]),
});

/**
 * POST /v1/auth/token
 *
 * Issues a signed JWT for demo / development purposes.
 * In production this endpoint must validate credentials against the users table.
 *
 * TODO: Add credential validation (email + password hash or API key lookup).
 */
export function authController() {
  const config = loadConfig();

  return {
    issueToken(req: Request, res: Response): void {
      const parsed = TokenRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400)
          .setHeader("Content-Type", "application/problem+json")
          .json({
            type: "https://ragkb.dev/problems/validation-error",
            title: "Validation failed",
            status: 400,
            detail: parsed.error.errors.map((e) => e.message).join("; "),
          });
        return;
      }

      const { tenantId, email, role } = parsed.data;
      const token = jwt.sign(
        { tenantId, email, role },
        config.JWT_SECRET,
        {
          issuer: config.JWT_ISSUER,
          audience: config.JWT_AUDIENCE,
          expiresIn: "1h",
        }
      );

      res.status(200).json({ token });
    },
  };
}
