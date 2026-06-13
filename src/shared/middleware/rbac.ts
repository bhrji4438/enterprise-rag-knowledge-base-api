import type { Request, Response, NextFunction } from "express";

/** Roles must match the JWT role claims issued by /v1/auth/token */
export type AppRole = "owner" | "admin" | "engineer" | "viewer" | "service_account";

/**
 * RBAC guard — attach after the `authenticate` middleware.
 * Usage: `requireRole("owner", "admin")`
 */
export function requireRole(...allowed: AppRole[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const role = res.locals["role"] as AppRole | undefined;
    if (!role || !allowed.includes(role)) {
      return res.status(403)
        .setHeader("Content-Type", "application/problem+json")
        .json({
          type: "https://ragkb.dev/problems/forbidden",
          title: "Forbidden",
          status: 403,
          detail: `Required role: ${allowed.join(" or ")}. Your role: ${role ?? "none"}.`,
        });
    }
    return next();
  };
}
