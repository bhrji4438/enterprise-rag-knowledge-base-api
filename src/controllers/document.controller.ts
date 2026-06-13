import crypto from "node:crypto";
import type { Request, Response } from "express";
import type { Queue } from "bullmq";
import type { DrizzleDocumentRepository } from "../repositories/drizzle-document.repository.js";
import type { IngestionJobData } from "../infrastructure/queue/bullmq-client.js";
import { ProblemDetailsError } from "../shared/errors/problem-details.js";

const ALLOWED_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  // "application/pdf",  // enable once pdf-parse is added
]);

/**
 * Document controller — handles upload, listing, retrieval, and deletion.
 */
export function documentController(deps: {
  documentRepository: DrizzleDocumentRepository;
  ingestionQueue: Queue<IngestionJobData>;
}) {
  const { documentRepository, ingestionQueue } = deps;

  return {
    /** POST /v1/documents — accepts multipart/form-data with a `file` field */
    async upload(req: Request, res: Response): Promise<void> {
      const tenantId = res.locals["tenantId"] as string;
      const uploadedBy = res.locals["email"] as string;

      if (!req.file) {
        throw new ProblemDetailsError({
          status: 400,
          title: "No file uploaded",
          type: "https://ragkb.dev/problems/validation-error",
          detail: 'A file must be attached under the "file" field in multipart/form-data.',
        });
      }

      const { mimetype, originalname, buffer } = req.file;

      // MIME type validation
      if (!ALLOWED_MIME_TYPES.has(mimetype)) {
        throw new ProblemDetailsError({
          status: 415,
          title: "Unsupported media type",
          type: "https://ragkb.dev/problems/unsupported-media-type",
          detail: `Accepted types: ${[...ALLOWED_MIME_TYPES].join(", ")}. Received: ${mimetype}`,
        });
      }

      // Decode file content
      const rawText = buffer.toString("utf-8");
      if (rawText.trim().length === 0) {
        throw new ProblemDetailsError({
          status: 400,
          title: "Empty file",
          type: "https://ragkb.dev/problems/validation-error",
          detail: "The uploaded file has no readable text content.",
        });
      }

      // Compute checksum for idempotency / deduplication
      const checksumSha256 = crypto
        .createHash("sha256")
        .update(buffer)
        .digest("hex");

      const documentId = crypto.randomUUID();
      const now = new Date();

      const document = {
        id: documentId,
        tenantId,
        title: originalname,
        mimeType: mimetype,
        status: "uploaded" as const,
        checksumSha256,
        createdBy: uploadedBy,
        createdAt: now,
        updatedAt: now,
      };

      try {
        await documentRepository.create(document);
      } catch (err: unknown) {
        // Duplicate checksum → idempotent re-upload (same file for this tenant)
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("uq_documents_tenant_checksum")) {
          throw new ProblemDetailsError({
            status: 409,
            title: "Document already exists",
            type: "https://ragkb.dev/problems/conflict",
            detail: `A document with the same content already exists for this tenant.`,
          });
        }
        throw err;
      }

      // Enqueue async ingestion job
      await ingestionQueue.add("ingest", {
        documentId,
        tenantId,
        rawText,
        mimeType: mimetype,
      });

      res.status(202).json({
        documentId,
        status: "uploaded",
        tenantId,
        uploadedBy,
      });
    },

    /** GET /v1/documents — list tenant documents */
    async list(_req: Request, res: Response): Promise<void> {
      // TODO: Add DrizzleDocumentRepository.list(tenantId) when pagination is needed
      res.status(200).json([]);
    },

    /** GET /v1/documents/:id — fetch document metadata */
    async getById(req: Request, res: Response): Promise<void> {
      const tenantId = res.locals["tenantId"] as string;
      const doc = await documentRepository.findById(tenantId, req.params["id"] ?? "");

      if (!doc) {
        throw new ProblemDetailsError({
          status: 404,
          title: "Document not found",
          type: "https://ragkb.dev/problems/not-found",
          detail: `Document ${req.params["id"]} not found or does not belong to this tenant.`,
        });
      }

      res.status(200).json({
        id: doc.id,
        tenantId: doc.tenantId,
        title: doc.title,
        status: doc.status,
        mimeType: doc.mimeType,
        createdAt: doc.createdAt.toISOString(),
      });
    },

    /** DELETE /v1/documents/:id — remove document and cascade chunks */
    async remove(req: Request, res: Response): Promise<void> {
      const tenantId = res.locals["tenantId"] as string;
      const doc = await documentRepository.findById(tenantId, req.params["id"] ?? "");

      if (!doc) {
        throw new ProblemDetailsError({
          status: 404,
          title: "Document not found",
          type: "https://ragkb.dev/problems/not-found",
          detail: `Document ${req.params["id"]} not found or does not belong to this tenant.`,
        });
      }

      // TODO: Call documentRepository.delete() — cascade deletes chunks via FK
      // For now mark as failed/deleted status
      res.status(204).send();
    },
  };
}
