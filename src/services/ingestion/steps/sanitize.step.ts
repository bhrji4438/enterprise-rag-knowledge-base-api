import type { IngestionContext, IngestionStep } from "../ingestion-pipeline.js";

/**
 * SanitizeStep — normalises raw text before chunking.
 *
 * - Strips null bytes and non-printable control characters
 * - Collapses runs of whitespace to single spaces
 * - Trims leading/trailing whitespace
 */
export class SanitizeStep implements IngestionStep {
  readonly name = "sanitize";

  async execute(context: IngestionContext): Promise<IngestionContext> {
    const cleaned = context.rawText
      // Remove null bytes and non-printable control chars (except \n, \r, \t)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Normalise Windows line endings
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Collapse runs of blank lines to max two newlines
      .replace(/\n{3,}/g, "\n\n")
      // Collapse horizontal whitespace runs
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    return { ...context, rawText: cleaned };
  }
}
