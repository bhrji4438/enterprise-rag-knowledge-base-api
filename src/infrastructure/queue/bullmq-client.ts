import { Queue, Worker } from "bullmq";

export const INGESTION_QUEUE_NAME = "document-ingestion";

/** Job data carried through the ingestion queue */
export interface IngestionJobData {
  documentId: string;
  tenantId: string;
  rawText: string;
  mimeType: string;
}

/**
 * BullMQ requires a Redis connection URL or its own IORedis instance.
 * We pass the URL string to avoid the ioredis version mismatch between
 * `ioredis` (app dependency) and BullMQ's bundled `ioredis`.
 */
export function createIngestionQueue(redisUrl: string): Queue<IngestionJobData> {
  return new Queue<IngestionJobData>(INGESTION_QUEUE_NAME, {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}

/** Type-safe factory for ingestion workers */
export function createIngestionWorker(
  redisUrl: string,
  processor: (job: { data: IngestionJobData; id?: string }) => Promise<void>
): Worker<IngestionJobData> {
  return new Worker<IngestionJobData>(
    INGESTION_QUEUE_NAME,
    async (job) => {
      await processor(job);
    },
    {
      connection: { url: redisUrl },
      concurrency: 2,
    }
  );
}
