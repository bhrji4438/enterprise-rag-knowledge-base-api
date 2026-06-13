import type { Request, Response, NextFunction } from "express";
import { ProblemDetailsError } from "../errors/problem-details.js";
import { ZodError } from "zod";

/**
 * Global Express error handler — must be the LAST middleware registered.
 * Returns RFC 7807 application/problem+json for all errors.
 * Never leaks stack traces or internal details to clients.
 */
export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // RFC 7807 domain errors — already formatted
  if (err instanceof ProblemDetailsError) {
    res
      .status(err.status)
      .setHeader("Content-Type", "application/problem+json")
      .json(err.toJSON());
    return;
  }

  // Zod validation errors — map to 400
  if (err instanceof ZodError) {
    res
      .status(400)
      .setHeader("Content-Type", "application/problem+json")
      .json({
        type: "https://ragkb.dev/problems/validation-error",
        title: "Validation failed",
        status: 400,
        detail: err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
      });
    return;
  }

  // Unknown errors — log internally, return sanitised 500
  console.error("[error]", err);
  res
    .status(500)
    .setHeader("Content-Type", "application/problem+json")
    .json({
      type: "https://ragkb.dev/problems/internal-error",
      title: "Internal Server Error",
      status: 500,
    });
}
