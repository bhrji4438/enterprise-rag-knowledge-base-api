import { loadConfig } from "../../config/env.js";
import type { LlmProvider, EmbeddingProvider } from "./llm-provider.js";
import { OpenAiProvider, OpenAiEmbeddingProvider } from "./openai-provider.js";
import { AnthropicProvider } from "./anthropic-provider.js";

/** Returns 3072-dim zero vectors — used in demo/test mode without a real embedding model */
export class MockEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly dimensions: number = 3072) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => {
      const vec = Array.from({ length: this.dimensions }, () => Math.random() - 0.5);
      const len = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
      return vec.map((v) => v / len);
    });
  }
}

export class LlmProviderFactory {
  static createLlmProvider(providerName: "openai" | "anthropic"): LlmProvider {
    const config = loadConfig();

    if (config.USE_MOCKS) {
      const ollamaUrl = config.OPENAI_BASE_URL ?? "http://localhost:11434/v1";
      return new OpenAiProvider({
        apiKey: "ollama",
        baseURL: ollamaUrl,
        model: config.OPENAI_CHAT_MODEL,
      });
    }

    if (providerName === "openai") {
      if (!config.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required when USE_MOCKS is false");
      }
      return new OpenAiProvider({
        apiKey: config.OPENAI_API_KEY,
        baseURL: config.OPENAI_BASE_URL,
        model: config.OPENAI_CHAT_MODEL,
      });
    }

    if (providerName === "anthropic") {
      if (!config.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is required when USE_MOCKS is false and Anthropic is chosen");
      }
      return new AnthropicProvider({
        apiKey: config.ANTHROPIC_API_KEY,
        model: "claude-3-5-sonnet-latest",
      });
    }

    throw new Error(`Unsupported LLM provider: ${providerName}`);
  }

  static createEmbeddingProvider(): EmbeddingProvider {
    const config = loadConfig();

    // In mock mode, return synthetic embeddings matching the schema's vector dimensions.
    // This avoids dimension mismatch when Ollama models return fewer dimensions than configured.
    if (config.USE_MOCKS) {
      return new MockEmbeddingProvider(config.EMBEDDING_DIMENSIONS);
    }

    if (!config.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required when USE_MOCKS is false for embeddings");
    }

    return new OpenAiEmbeddingProvider({
      apiKey: config.OPENAI_API_KEY,
      baseURL: config.OPENAI_BASE_URL,
      model: config.OPENAI_EMBEDDING_MODEL,
    });
  }
}
