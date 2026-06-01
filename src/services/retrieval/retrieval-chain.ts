import type { RetrievalHit, TenantId } from "../../domain/documents/entities.js";

export interface RetrievalRequest {
  tenantId: TenantId;
  question: string;
  topK: number;
  filters?: Record<string, unknown>;
  embedding?: number[];
  hits?: RetrievalHit[];
}

export interface RetrievalHandler {
  setNext(handler: RetrievalHandler): RetrievalHandler;
  handle(request: RetrievalRequest): Promise<RetrievalRequest>;
}

export abstract class BaseRetrievalHandler implements RetrievalHandler {
  private next?: RetrievalHandler;

  setNext(handler: RetrievalHandler): RetrievalHandler {
    this.next = handler;
    return handler;
  }

  async handle(request: RetrievalRequest): Promise<RetrievalRequest> {
    const result = await this.process(request);
    return this.next ? this.next.handle(result) : result;
  }

  protected abstract process(request: RetrievalRequest): Promise<RetrievalRequest>;
}
