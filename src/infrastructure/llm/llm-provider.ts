export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  tenantId: string;
  userId: string;
  messages: ChatMessage[];
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface LlmResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface LlmProvider {
  readonly name: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}
