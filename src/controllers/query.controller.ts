import type { Request, Response } from "express";
import { z } from "zod";
import type { AnswerService } from "../services/qa/answer.service.js";
import { ProblemDetailsError } from "../shared/errors/problem-details.js";
import { loadConfig } from "../config/env.js";

const QueryRequestSchema = z.object({
  question: z.string().min(1, "question must not be blank").max(2000),
  topK: z.coerce.number().int().min(1).max(20).optional(),
});

export function queryController(deps: { answerService: AnswerService }) {
  const { answerService } = deps;
  const config = loadConfig();

  return {
    /** POST /v1/query — synchronous answer with citations */
    async query(req: Request, res: Response): Promise<void> {
      const parsed = QueryRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ProblemDetailsError({
          status: 400,
          title: "Validation failed",
          type: "https://ragkb.dev/problems/validation-error",
          detail: parsed.error.errors.map((e) => e.message).join("; "),
        });
      }

      const tenantId = res.locals["tenantId"] as string;
      const userId = res.locals["email"] as string;
      const { question, topK } = parsed.data;

      const result = await answerService.answer({
        tenantId,
        userId,
        question,
        topK: topK ?? config.DEFAULT_TOP_K,
      });

      res.status(200).json(result);
    },

    /** POST /v1/query/stream — SSE streaming answer */
    async stream(req: Request, res: Response): Promise<void> {
      const parsed = QueryRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ProblemDetailsError({
          status: 400,
          title: "Validation failed",
          type: "https://ragkb.dev/problems/validation-error",
          detail: parsed.error.errors.map((e) => e.message).join("; "),
        });
      }

      const tenantId = res.locals["tenantId"] as string;
      const userId = res.locals["email"] as string;
      const { question, topK } = parsed.data;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering

      try {
        // Get the real answer first, then stream it word-by-word
        // TODO: Replace with true OpenAI streaming (provider.stream()) in a future iteration
        const result = await answerService.answer({
          tenantId,
          userId,
          question,
          topK: topK ?? config.DEFAULT_TOP_K,
        });

        const words = result.answer.split(" ");
        let i = 0;

        const interval = setInterval(() => {
          if (i < words.length) {
            res.write(`data: ${JSON.stringify({ token: (words[i] ?? "") + " " })}\n\n`);
            i++;
          } else {
            res.write(`data: ${JSON.stringify({ citations: result.citations })}\n\n`);
            res.write("data: [DONE]\n\n");
            clearInterval(interval);
            res.end();
          }
        }, 30);

        req.on("close", () => clearInterval(interval));
      } catch (err) {
        // Emit error over SSE before closing
        const detail = err instanceof Error ? err.message : "Unknown error";
        res.write(`data: ${JSON.stringify({ error: detail })}\n\n`);
        res.end();
      }
    },
  };
}
