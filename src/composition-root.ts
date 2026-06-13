import { loadConfig } from "./config/env.js";
import { db } from "./infrastructure/db/connection.js";
import { createRedisClient } from "./infrastructure/cache/redis-client.js";
import { RedisPromptCache } from "./infrastructure/cache/redis-prompt-cache.js";
import { RedisTokenBudgetPolicy } from "./infrastructure/budget/token-budget.js";
import { LlmFacade } from "./infrastructure/llm/llm-facade.js";
import { LlmProviderFactory } from "./infrastructure/llm/provider-factory.js";
import { DrizzleDocumentRepository } from "./repositories/drizzle-document.repository.js";
import { DrizzleVectorRepository } from "./repositories/drizzle-vector.repository.js";
import {
  IngestionPipeline,
  PersistEmbeddingsStep,
} from "./services/ingestion/ingestion-pipeline.js";
import { SanitizeStep } from "./services/ingestion/steps/sanitize.step.js";
import { ChunkStep } from "./services/ingestion/steps/chunk.step.js";
import { EmbeddingRetrievalHandler } from "./services/retrieval/handlers/embedding.handler.js";
import { VectorSearchHandler } from "./services/retrieval/handlers/vector-search.handler.js";
import { AnswerService } from "./services/qa/answer.service.js";
import {
  createIngestionQueue,
  createIngestionWorker,
  type IngestionJobData,
} from "./infrastructure/queue/bullmq-client.js";
import type { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";

export interface AppDependencies {
  db: any;
  redis: Redis;
  documentRepository: DrizzleDocumentRepository;
  vectorRepository: DrizzleVectorRepository;
  answerService: AnswerService;
  ingestionPipeline: IngestionPipeline;
  ingestionQueue: Queue<IngestionJobData>;
  ingestionWorker: Worker<IngestionJobData>;
}

let _deps: AppDependencies | undefined;

export function setDependencies(deps: AppDependencies): void {
  _deps = deps;
}

export async function createDependencies(): Promise<AppDependencies> {
  if (_deps) return _deps;

  const config = loadConfig();
  const redis = createRedisClient(config.REDIS_URL);

  // ── Repositories ───────────────────────────────────────────────────────────
  const documentRepository = new DrizzleDocumentRepository();
  const vectorRepository = new DrizzleVectorRepository();

  // ── LLM ────────────────────────────────────────────────────────────────────
  const embeddingProvider = LlmProviderFactory.createEmbeddingProvider();
  const primaryProvider = LlmProviderFactory.createLlmProvider("openai");
  const providers = config.ANTHROPIC_API_KEY
    ? [primaryProvider, LlmProviderFactory.createLlmProvider("anthropic")]
    : [primaryProvider];

  const promptCache = new RedisPromptCache(redis, config.PROMPT_CACHE_TTL_SECONDS);
  const budgetPolicy = new RedisTokenBudgetPolicy(redis, config.TENANT_MONTHLY_TOKEN_BUDGET);
  const llmFacade = new LlmFacade(providers, budgetPolicy, promptCache);

  // ── Retrieval chain: Embedding → VectorSearch ──────────────────────────────
  const embeddingHandler = new EmbeddingRetrievalHandler(embeddingProvider);
  const vectorSearchHandler = new VectorSearchHandler(vectorRepository);
  embeddingHandler.setNext(vectorSearchHandler);

  const answerService = new AnswerService(embeddingHandler, llmFacade);

  // ── Ingestion pipeline: Sanitize → Chunk → PersistEmbeddings ──────────────
  const ingestionPipeline = new IngestionPipeline([
    new SanitizeStep(),
    new ChunkStep(config.MAX_CHUNK_TOKENS, config.CHUNK_OVERLAP_TOKENS),
    new PersistEmbeddingsStep(embeddingProvider, documentRepository, vectorRepository),
  ]);

  // ── BullMQ queue and in-process worker ────────────────────────────────────
  const ingestionQueue = createIngestionQueue(config.REDIS_URL);
  const ingestionWorker = createIngestionWorker(config.REDIS_URL, async (job) => {
    const data = job.data as IngestionJobData;
    console.info(`[worker] processing document ${data.documentId} for tenant ${data.tenantId}`);

    await documentRepository.markProcessing(data.tenantId, data.documentId);

    // Fetch the document entity from DB (needed for pipeline context)
    const document = await documentRepository.findById(data.tenantId, data.documentId);
    if (!document) throw new Error(`Document ${data.documentId} not found`);

    await ingestionPipeline.run({
      document,
      rawText: data.rawText,
      chunks: [],
    });

    console.info(`[worker] indexed document ${data.documentId}`);
  });

  ingestionWorker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id ?? "?"} failed:`, err.message);
  });

  _deps = {
    db,
    redis,
    documentRepository,
    vectorRepository,
    answerService,
    ingestionPipeline,
    ingestionQueue,
    ingestionWorker,
  };

  return _deps;
}
