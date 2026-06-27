import { BadRequestException, Injectable } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ProviderPreset } from "@ai-novel-diagnosis/ai-core";
import { ProviderConfigDto } from "./dto/provider-config.dto";

export interface ProviderMessage {
  role: "system" | "user";
  content: string;
}

export interface ProviderChatOptions {
  maxOutputTokens?: number;
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
  };
}

interface OpenAICompatibleContentPart {
  type?: string;
  text?: string;
  content?: string;
  reasoning_content?: string;
  reasoning?: string;
}

interface OpenAICompatibleChatChoice {
  message?: {
    content?: string | Array<string | OpenAICompatibleContentPart> | null;
    reasoning_content?: string | null;
    reasoning?: string | null;
    refusal?: string | null;
    tool_calls?: Array<{
      function?: {
        arguments?: string | null;
      };
    }> | null;
    [key: string]: unknown;
  };
  text?: string | null;
  finish_reason?: string | null;
  reasoning_content?: string | null;
  reasoning?: string | null;
  [key: string]: unknown;
}

interface ExtractedProviderContent {
  text: string;
  source:
    | "message_content"
    | "reasoning_content"
    | "content_with_reasoning"
    | "choice_text"
    | "tool_call_arguments"
    | "empty";
}

interface OpenAICompatibleChatResponse {
  choices?: OpenAICompatibleChatChoice[];
}

const providerPresets: Array<
  ProviderPreset & { id: NonNullable<ProviderConfigDto["preset"]> }
> = [
  {
    id: "custom",
    label: "自定义 OpenAI-compatible",
    kind: "openai-compatible",
    baseUrl: "",
    model: "",
    modelOptions: [],
    jsonMode: false,
    needsApiKey: true,
  },
  {
    id: "shared-gpu",
    label: "免费共享算力",
    kind: "openai-compatible",
    baseUrl: "",
    model: "",
    modelOptions: [],
    jsonMode: false,
    needsApiKey: false,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    modelOptions: ["deepseek-chat", "deepseek-reasoner"],
    jsonMode: false,
    needsApiKey: true,
  },
  {
    id: "doubao",
    label: "豆包/火山方舟",
    kind: "openai-compatible",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-1-6",
    modelOptions: ["doubao-seed-1-6"],
    jsonMode: false,
    needsApiKey: true,
  },
  {
    id: "qwen",
    label: "阿里云百炼/通义千问",
    kind: "openai-compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    modelOptions: [
      "qwen-plus",
      "qwen-plus-latest",
      "qwen3-max",
      "qwen3-max-preview",
      "qwen-max",
      "qwen-max-latest",
      "qwen-flash",
      "qwen-turbo",
      "qwen-turbo-latest",
      "qwen3.5-plus",
      "qwen3.5-flash",
      "qwen3-coder-plus",
      "qwen3-coder-flash",
      "qwq-plus",
    ],
    jsonMode: false,
    needsApiKey: true,
  },
  {
    id: "ollama",
    label: "Ollama 本地模型",
    kind: "openai-compatible",
    baseUrl: "http://localhost:11434/v1",
    model: "qwen2.5:7b",
    modelOptions: ["qwen2.5:7b", "qwen3:8b", "llama3.1:8b"],
    jsonMode: false,
    needsApiKey: false,
  },
];

const defaultSharedGpuFallback = {
  apiKey: "0000000000",
  baseUrl: "https://aihorde.net/api/v2",
  label: "AI Horde 匿名共享池",
};

// Shared/public providers often queue for a while during book-scale analysis.
// Keep the default generous, while still allowing env override per deployment.
const DEFAULT_PROVIDER_TIMEOUT_MS = 180_000;
const MAX_ERROR_BODY_LENGTH = 1_000;
const DEFAULT_LENGTH_RETRY_MAX_OUTPUT_TOKENS = 8_192;

function providerTimeoutMs() {
  const raw = Number(process.env.PROVIDER_REQUEST_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PROVIDER_TIMEOUT_MS;
}

function providerLengthRetryMaxOutputTokens() {
  const raw = Number(process.env.PROVIDER_LENGTH_RETRY_MAX_OUTPUT_TOKENS);
  return Number.isFinite(raw) && raw > 0
    ? raw
    : DEFAULT_LENGTH_RETRY_MAX_OUTPUT_TOKENS;
}

function isPrivateIpAddress(address: string) {
  if (address === "::1") return true;
  if (address.startsWith("fe80:")) return true;
  if (address.startsWith("fc") || address.startsWith("fd")) return true;

  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first === 0
  );
}

function isAllowedLocalOllama(provider: ProviderConfigDto, url: URL) {
  return (
    provider.preset === "ollama" &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname) &&
    (url.port === "" || url.port === "11434")
  );
}

@Injectable()
export class ModelProviderService {
  getPresets() {
    return providerPresets;
  }

  async test(provider: ProviderConfigDto) {
    const resolved = this.resolve(provider);
    if (resolved.kind === "mock") {
      return {
        ok: true,
        provider: "mock",
        preset: provider.preset || "custom",
        message: "mock provider ready",
      };
    }

    const result = await this.chat(
      resolved,
      [
        {
          role: "system",
          content: "你是连接测试器。只返回 JSON，不要解释。",
        },
        {
          role: "user",
          content: '请返回 {"ok":true,"message":"connected"}',
        },
      ],
      { maxOutputTokens: 256 },
    );

    return {
      ok: true,
      provider: resolved.kind,
      preset: provider.preset || "custom",
      model: resolved.model,
      raw: result,
    };
  }

  async chat(
    provider: ProviderConfigDto,
    messages: ProviderMessage[],
    options: ProviderChatOptions = {},
  ) {
    const resolved = this.resolve(provider);
    if (resolved.kind === "mock") {
      throw new BadRequestException(
        "Mock provider does not support chat calls.",
      );
    }

    if (this.shouldUseSharedGpuFallback(provider, resolved)) {
      return this.callSharedGpuFallback(messages, options);
    }

    return this.callOpenAICompatible(resolved, messages, options);
  }

  resolve(provider: ProviderConfigDto): ProviderConfigDto {
    if (provider.kind === "mock") {
      return provider;
    }

    const preset = providerPresets.find((item) => item.id === provider.preset);

    if (provider.preset === "shared-gpu") {
      return {
        ...provider,
        kind: "openai-compatible",
        baseUrl: process.env.SHARED_GPU_BASE_URL?.trim(),
        apiKey: process.env.SHARED_GPU_API_KEY?.trim(),
        model: process.env.SHARED_GPU_MODEL?.trim(),
        jsonMode:
          process.env.SHARED_GPU_JSON_MODE === "true"
            ? true
            : (preset?.jsonMode ?? false),
      };
    }

    return {
      ...provider,
      kind: "openai-compatible",
      baseUrl: provider.baseUrl?.trim() || preset?.baseUrl,
      model: provider.model?.trim() || preset?.model,
      jsonMode: provider.jsonMode ?? preset?.jsonMode ?? false,
    };
  }

  private async callOpenAICompatible(
    provider: ProviderConfigDto,
    messages: ProviderMessage[],
    options: ProviderChatOptions,
    hasRetriedLength = false,
  ): Promise<string> {
    if (!provider.baseUrl || !provider.model) {
      if (provider.preset === "shared-gpu") {
        throw new BadRequestException(
          "免费共享算力尚未配置：请在 API 服务环境变量中设置 SHARED_GPU_BASE_URL 和 SHARED_GPU_MODEL。",
        );
      }

      throw new BadRequestException(
        "OpenAI-compatible provider requires baseUrl and model.",
      );
    }

    await this.assertSafeProviderBaseUrl(provider);

    const preset = providerPresets.find((item) => item.id === provider.preset);
    if (preset?.needsApiKey !== false && !provider.apiKey) {
      const providerLabel = preset?.label || "OpenAI-compatible provider";
      throw new BadRequestException(
        `${providerLabel} requires a user-owned API key for this request.`,
      );
    }

    const url = `${provider.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const body: Record<string, unknown> = {
      model: provider.model,
      messages,
      temperature: provider.temperature ?? 0.2,
    };
    if (options.maxOutputTokens) {
      body.max_tokens = options.maxOutputTokens;
    }

    if (options.jsonSchema && this.shouldUseJsonSchema(provider)) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: options.jsonSchema.name,
          strict: true,
          schema: options.jsonSchema.schema,
        },
      };
    } else if (provider.jsonMode || options.jsonSchema) {
      body.response_format = { type: "json_object" };
    }

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (provider.apiKey) {
      headers.authorization = `Bearer ${provider.apiKey}`;
    }

    const response = await this.fetchWithTimeout(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok && options.jsonSchema && body.response_format) {
      return this.callOpenAICompatible(provider, messages, {
        ...options,
        jsonSchema: undefined,
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(
        `Provider request failed: ${response.status} ${errorText.slice(0, MAX_ERROR_BODY_LENGTH)}`,
      );
    }

    const data = (await response.json()) as OpenAICompatibleChatResponse;
    const firstChoice = data.choices?.[0];
    const extracted = this.extractOpenAICompatibleContent(firstChoice, options);
    if (
      this.isLengthTruncated(firstChoice) &&
      this.canRetryLength(options, hasRetriedLength)
    ) {
      return this.callOpenAICompatible(
        provider,
        messages,
        {
          ...options,
          maxOutputTokens: this.lengthRetryMaxOutputTokens(options),
        },
        true,
      );
    }

    if (this.isLengthTruncated(firstChoice) && !extracted.text) {
      throw new BadRequestException(
        this.describeLengthTruncatedProviderContent(firstChoice, options),
      );
    }

    if (!extracted.text) {
      throw new BadRequestException(
        this.describeMissingProviderContent(firstChoice),
      );
    }

    return extracted.text;
  }

  private isLengthTruncated(choice: OpenAICompatibleChatChoice | undefined) {
    return choice?.finish_reason === "length";
  }

  private canRetryLength(
    options: ProviderChatOptions,
    hasRetriedLength: boolean,
  ) {
    if (hasRetriedLength) {
      return false;
    }

    return (
      this.lengthRetryMaxOutputTokens(options) > (options.maxOutputTokens ?? 0)
    );
  }

  private lengthRetryMaxOutputTokens(options: ProviderChatOptions) {
    const configuredMax = providerLengthRetryMaxOutputTokens();
    const requested = options.maxOutputTokens ?? 0;
    return Math.min(configuredMax, Math.max(4096, requested * 4));
  }

  private extractOpenAICompatibleContent(
    choice: OpenAICompatibleChatChoice | undefined,
    options: ProviderChatOptions,
  ): ExtractedProviderContent {
    const messageContent = this.extractMessageContent(choice);
    const reasoningContent = this.extractReasoningContent(choice);

    if (
      messageContent &&
      reasoningContent &&
      !options.jsonSchema &&
      !this.looksLikeJsonContent(messageContent)
    ) {
      return {
        text: `<think>\n${reasoningContent}\n</think>\n${messageContent}`,
        source: "content_with_reasoning",
      };
    }

    if (messageContent) {
      return { text: messageContent, source: "message_content" };
    }

    if (reasoningContent) {
      return { text: reasoningContent, source: "reasoning_content" };
    }

    const toolCallArguments = this.extractToolCallArguments(choice);
    if (toolCallArguments) {
      return { text: toolCallArguments, source: "tool_call_arguments" };
    }

    if (typeof choice?.text === "string" && choice.text.trim()) {
      return { text: choice.text, source: "choice_text" };
    }

    return { text: "", source: "empty" };
  }

  private looksLikeJsonContent(content: string) {
    const trimmed = content.trimStart();
    return trimmed.startsWith("{") || trimmed.startsWith("[");
  }

  private extractMessageContent(
    choice: OpenAICompatibleChatChoice | undefined,
  ) {
    const messageContent = choice?.message?.content;
    if (typeof messageContent === "string" && messageContent.trim()) {
      return messageContent;
    }
    if (Array.isArray(messageContent)) {
      const text = messageContent
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }
          if (typeof part?.text === "string") {
            return part.text;
          }
          if (typeof part?.content === "string") {
            return part.content;
          }
          if (typeof part?.reasoning_content === "string") {
            return part.reasoning_content;
          }
          if (typeof part?.reasoning === "string") {
            return part.reasoning;
          }
          return "";
        })
        .join("")
        .trim();
      if (text) {
        return text;
      }
    }
    return "";
  }

  private extractReasoningContent(
    choice: OpenAICompatibleChatChoice | undefined,
  ) {
    const candidates = [
      choice?.message?.reasoning_content,
      choice?.message?.reasoning,
      choice?.reasoning_content,
      choice?.reasoning,
    ];
    return (
      candidates
        .find((item) => typeof item === "string" && item.trim())
        ?.trim() ?? ""
    );
  }

  private extractToolCallArguments(
    choice: OpenAICompatibleChatChoice | undefined,
  ) {
    const toolCalls = choice?.message?.tool_calls;
    if (!Array.isArray(toolCalls)) {
      return "";
    }

    return toolCalls
      .map((toolCall) => toolCall.function?.arguments?.trim() || "")
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  private describeMissingProviderContent(
    choice: OpenAICompatibleChatChoice | undefined,
  ) {
    if (!choice) {
      return "Provider response did not include choices.";
    }

    const messageKeys = choice.message ? Object.keys(choice.message) : [];
    const choiceKeys = Object.keys(choice);
    const refusal =
      typeof choice.message?.refusal === "string" &&
      choice.message.refusal.trim()
        ? ` refusal=${choice.message.refusal.slice(0, 120)}`
        : "";
    const finishReason = choice.finish_reason
      ? ` finish_reason=${choice.finish_reason}`
      : "";
    return `Provider response did not include message content.${finishReason} choice_keys=${choiceKeys.join(",") || "none"} message_keys=${messageKeys.join(",") || "none"}${refusal}`;
  }

  private describeLengthTruncatedProviderContent(
    choice: OpenAICompatibleChatChoice | undefined,
    options: ProviderChatOptions,
  ) {
    const retryMax = this.lengthRetryMaxOutputTokens(options);
    const requested = options.maxOutputTokens ?? "default";
    return `模型输出被截断，Provider 没有返回完整可用正文。finish_reason=length requested_max_tokens=${requested} retry_max_tokens=${retryMax}。请换用更大输出额度/非推理模型，或缩短待分析文本后重试。${this.describeProviderShape(choice)}`;
  }

  private describeProviderShape(
    choice: OpenAICompatibleChatChoice | undefined,
  ) {
    if (!choice) {
      return " provider_shape=missing_choice";
    }

    const messageKeys = choice.message ? Object.keys(choice.message) : [];
    const choiceKeys = Object.keys(choice);
    return ` choice_keys=${choiceKeys.join(",") || "none"} message_keys=${messageKeys.join(",") || "none"}`;
  }

  private shouldUseJsonSchema(provider: ProviderConfigDto) {
    if (provider.preset === "shared-gpu" || provider.preset === "ollama") {
      return false;
    }

    const baseUrl = provider.baseUrl?.toLowerCase() || "";
    return (
      baseUrl.includes("api.openai.com") ||
      baseUrl.includes("openai.azure.com") ||
      process.env.ENABLE_OPENAI_COMPAT_JSON_SCHEMA === "true"
    );
  }

  private shouldUseSharedGpuFallback(
    originalProvider: ProviderConfigDto,
    resolvedProvider: ProviderConfigDto,
  ) {
    return (
      originalProvider.preset === "shared-gpu" &&
      (!resolvedProvider.baseUrl || !resolvedProvider.model)
    );
  }

  private async callSharedGpuFallback(
    messages: ProviderMessage[],
    options: ProviderChatOptions,
  ) {
    const prompt = this.buildSharedGpuFallbackPrompt(messages);
    const maxLength = Math.max(
      64,
      Math.min(512, options.maxOutputTokens ?? 256),
    );
    const maxContextLength = Math.max(1024, Math.min(8192, prompt.length * 2));

    const submitResponse = await this.fetchWithTimeout(
      `${defaultSharedGpuFallback.baseUrl}/generate/text/async`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: defaultSharedGpuFallback.apiKey,
          "Client-Agent": "ai-novel-diagnosis:shared-fallback",
        },
        body: JSON.stringify({
          prompt,
          params: {
            max_context_length: maxContextLength,
            max_length: maxLength,
          },
          trusted_workers: false,
          validated_backends: true,
          slow_workers: true,
        }),
      },
    );

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new BadRequestException(
        `免费共享算力暂时不可用：${submitResponse.status} ${errorText.slice(0, 300)}`,
      );
    }

    const queued = (await submitResponse.json()) as { id?: string };
    if (!queued.id) {
      throw new BadRequestException(
        "免费共享算力提交成功，但没有返回任务 ID。",
      );
    }

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const statusResponse = await this.fetchWithTimeout(
        `${defaultSharedGpuFallback.baseUrl}/generate/text/status/${queued.id}`,
        {
          headers: {
            "Client-Agent": "ai-novel-diagnosis:shared-fallback",
          },
        },
      );

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new BadRequestException(
          `免费共享算力查询失败：${statusResponse.status} ${errorText.slice(0, 300)}`,
        );
      }

      const status = (await statusResponse.json()) as {
        done?: boolean;
        faulted?: boolean;
        generations?: Array<{ text?: string; state?: string }>;
      };
      const text = status.generations?.find((item) => item.text)?.text?.trim();

      if (text) {
        return text;
      }

      if (status.faulted) {
        throw new BadRequestException("免费共享算力任务失败。");
      }

      if (status.done) {
        throw new BadRequestException(
          "免费共享算力已完成任务，但没有返回文本内容。",
        );
      }
    }

    throw new BadRequestException("免费共享算力排队超时，请稍后重试。");
  }

  private buildSharedGpuFallbackPrompt(messages: ProviderMessage[]) {
    return messages
      .map(
        (message) =>
          `${message.role === "system" ? "[System]" : "[User]"}\n${message.content}`,
      )
      .join("\n\n");
  }

  private async assertSafeProviderBaseUrl(provider: ProviderConfigDto) {
    if (!provider.baseUrl) {
      return;
    }

    let url: URL;
    try {
      url = new URL(provider.baseUrl);
    } catch {
      throw new BadRequestException("Provider baseUrl must be a valid URL.");
    }

    if (isAllowedLocalOllama(provider, url)) {
      return;
    }

    if (url.protocol !== "https:") {
      throw new BadRequestException(
        "Provider baseUrl must use https unless the Ollama preset is selected.",
      );
    }

    const host = url.hostname;
    if (["localhost", "127.0.0.1", "::1"].includes(host)) {
      throw new BadRequestException(
        "Provider baseUrl cannot point to localhost. Use the Ollama preset for local models.",
      );
    }

    const addresses = isIP(host)
      ? [{ address: host }]
      : await lookup(host, { all: true, verbatim: true });
    if (addresses.some((item) => isPrivateIpAddress(item.address))) {
      throw new BadRequestException(
        "Provider baseUrl cannot resolve to a private or link-local address.",
      );
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), providerTimeoutMs());
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new BadRequestException(
          "Provider request timed out. Retry later, switch to a faster provider, or raise PROVIDER_REQUEST_TIMEOUT_MS.",
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
