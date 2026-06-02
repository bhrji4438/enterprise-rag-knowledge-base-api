import type { LlmProvider, LlmRequest, LlmResponse } from "./llm-provider.js";

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: { apiKey: string; model: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const systemMessage = request.messages.find((m) => m.role === "system");
    const systemPrompt = systemMessage ? systemMessage.content : undefined;

    const chatMessages = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content
      }));

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          messages: chatMessages,
          system: systemPrompt,
          max_tokens: request.maxOutputTokens,
          temperature: request.temperature
        }),
        signal: controller.signal
      });

      clearTimeout(id);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        content: Array<{ text: string }>;
        model: string;
        usage?: {
          input_tokens: number;
          output_tokens: number;
        };
      };

      const content = data.content[0]?.text || "";
      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;
      const costUsd = this.calculateCost(inputTokens, outputTokens);

      return {
        content,
        model: data.model || this.model,
        inputTokens,
        outputTokens,
        costUsd
      };
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    if (this.model.includes("claude-3-5-sonnet")) {
      return (inputTokens * 3.0 + outputTokens * 15.0) / 1_000_000;
    }
    return 0.0;
  }
}
