import { OpenAI } from "openai";
import type { LlmProvider, LlmRequest, LlmResponse, EmbeddingProvider } from "./llm-provider.js";

export class OpenAiProvider implements LlmProvider {
  readonly name = "openai";
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: { apiKey?: string | undefined; baseURL?: string | undefined; model: string }) {
    this.client = new OpenAI({
      apiKey: config.apiKey || "mock-key",
      baseURL: config.baseURL
    });
    this.model = config.model;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: request.temperature,
      max_tokens: request.maxOutputTokens
    }, {
      timeout: request.timeoutMs
    });

    const choice = response.choices[0];
    const content = choice?.message?.content || "";
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;

    const costUsd = this.calculateCost(inputTokens, outputTokens);

    return {
      content,
      model: response.model || this.model,
      inputTokens,
      outputTokens,
      costUsd
    };
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    if (this.model.includes("gpt-4o-mini")) {
      return (inputTokens * 0.15 + outputTokens * 0.6) / 1_000_000;
    }
    if (this.model.includes("gpt-4")) {
      return (inputTokens * 5.0 + outputTokens * 15.0) / 1_000_000;
    }
    return 0.0;
  }
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: { apiKey?: string | undefined; baseURL?: string | undefined; model: string }) {
    this.client = new OpenAI({
      apiKey: config.apiKey || "mock-key",
      baseURL: config.baseURL
    });
    this.model = config.model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts
    });

    const sortedData = [...response.data].sort((a, b) => a.index - b.index);
    return sortedData.map((item) => item.embedding);
  }
}
