import { BadRequestException, Injectable } from "@nestjs/common";
import { ProviderConfigDto } from "./dto/provider-config.dto";

export interface ProviderMessage {
  role: "system" | "user";
  content: string;
}

export interface ProviderChatOptions {
  maxOutputTokens?: number;
}

export interface ProviderPreset {
  id:
    | "custom"
    | "ai-horde"
    | "openrouter-free"
    | "shared-gpu"
    | "deepseek"
    | "doubao"
    | "qwen"
    | "ollama";
  label: string;
  kind: ProviderConfigDto["kind"];
  baseUrl: string;
  model: string;
  modelOptions?: string[];
  jsonMode: boolean;
  needsApiKey: boolean;
}

const providerPresets: ProviderPreset[] = [
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
    id: "ai-horde",
    label: "AI Horde 公共模型池",
    kind: "ai-horde",
    baseUrl: "https://aihorde.net/api/v2",
    model: "aphrodite/TheDrummer/Cydonia-24B-v4.3",
    modelOptions: [
      "aphrodite/TheDrummer/Cydonia-24B-v4.3",
      "aphrodite/TheDrummer/Skyfall-31B-v4.2",
      "aphrodite/SicariusSicariiStuff/Impish_Bloodmoon_12B",
      "koboldcpp/Cydonia-24B-v4.3",
    ],
    jsonMode: false,
    needsApiKey: false,
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
    id: "openrouter-free",
    label: "OpenRouter 免费模型",
    kind: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openrouter/free",
    modelOptions: [
      "openrouter/free",
      "deepseek/deepseek-r1:free",
      "qwen/qwen3-coder:free",
      "meta-llama/llama-3.2-3b-instruct:free",
    ],
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

@Injectable()
export class ModelProviderService {
  getPresets() {
    return providerPresets;
  }

  async getHordeTextModels() {
    const response = await fetch(
      "https://aihorde.net/api/v2/status/models?type=text",
      {
        headers: {
          "Client-Agent": this.hordeClientAgent(),
        },
      },
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(
        `AI Horde model list failed: ${response.status} ${errorText.slice(0, 500)}`,
      );
    }

    const models = (await response.json()) as Array<{
      count?: number;
      eta?: number;
      jobs?: number;
      name?: string;
      performance?: number;
      queued?: number;
      type?: string;
    }>;

    return models
      .filter(
        (model) =>
          model.type === "text" && model.name && (model.count ?? 0) > 0,
      )
      .sort((left, right) => {
        const leftEta = left.eta ?? Number.MAX_SAFE_INTEGER;
        const rightEta = right.eta ?? Number.MAX_SAFE_INTEGER;
        if (leftEta !== rightEta) {
          return leftEta - rightEta;
        }
        return (right.performance ?? 0) - (left.performance ?? 0);
      })
      .slice(0, 30)
      .map((model) => ({
        name: model.name,
        workers: model.count ?? 0,
        eta: model.eta ?? 0,
        queued: model.queued ?? 0,
        performance: model.performance ?? 0,
        jobs: model.jobs ?? 0,
      }));
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

    if (resolved.kind === "ai-horde") {
      return this.callAiHorde(resolved, messages, options);
    }

    return this.callOpenAICompatible(resolved, messages, options);
  }

  resolve(provider: ProviderConfigDto): ProviderConfigDto {
    if (provider.kind === "mock") {
      return provider;
    }

    const preset = providerPresets.find((item) => item.id === provider.preset);
    if (provider.preset === "ai-horde" || provider.kind === "ai-horde") {
      return {
        ...provider,
        kind: "ai-horde",
        baseUrl: "https://aihorde.net/api/v2",
        apiKey:
          provider.apiKey?.trim() ||
          process.env.AI_HORDE_API_KEY?.trim() ||
          "0000000000",
        model:
          provider.model?.trim() ||
          process.env.AI_HORDE_MODEL?.trim() ||
          preset?.model,
        jsonMode: false,
      };
    }

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

    if (provider.preset === "openrouter-free") {
      return {
        ...provider,
        kind: "openai-compatible",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY?.trim(),
        model:
          provider.model?.trim() ||
          process.env.OPENROUTER_FREE_MODEL?.trim() ||
          "openrouter/free",
        jsonMode: provider.jsonMode ?? preset?.jsonMode ?? false,
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

    const preset = providerPresets.find((item) => item.id === provider.preset);
    if (provider.preset === "openrouter-free" && !provider.apiKey) {
      throw new BadRequestException(
        "OpenRouter 免费模型尚未配置：请在 API 服务环境变量中设置 OPENROUTER_API_KEY。",
      );
    }

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

    if (provider.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (provider.apiKey) {
      headers.authorization = `Bearer ${provider.apiKey}`;
    }
    if (provider.preset === "openrouter-free") {
      if (process.env.OPENROUTER_HTTP_REFERER) {
        headers["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER;
      }
      if (process.env.OPENROUTER_APP_TITLE) {
        headers["X-OpenRouter-Title"] = process.env.OPENROUTER_APP_TITLE;
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(
        `Provider request failed: ${response.status} ${errorText.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new BadRequestException(
        "Provider response did not include message content.",
      );
    }

    return content;
  }

  private async callAiHorde(
    provider: ProviderConfigDto,
    messages: ProviderMessage[],
    options: ProviderChatOptions,
  ): Promise<string> {
    if (!provider.model) {
      throw new BadRequestException("AI Horde requires a selected text model.");
    }

    const baseUrl = (provider.baseUrl || "https://aihorde.net/api/v2").replace(
      /\/+$/,
      "",
    );
    const maxLength = this.hordeMaxLength(options.maxOutputTokens);
    const submitResponse = await fetch(`${baseUrl}/generate/text/async`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: provider.apiKey || "0000000000",
        "Client-Agent": this.hordeClientAgent(),
      },
      body: JSON.stringify({
        prompt: this.toHordePrompt(messages),
        models: [provider.model],
        params: {
          max_context_length: 4096,
          max_length: maxLength,
          temperature: provider.temperature ?? 0.2,
          stop_sequence: ["\nUser:", "\n用户："],
        },
        trusted_workers: false,
        slow_workers: true,
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new BadRequestException(
        `AI Horde request failed: ${submitResponse.status} ${errorText.slice(0, 500)}`,
      );
    }

    const submitted = (await submitResponse.json()) as { id?: string };
    if (!submitted.id) {
      throw new BadRequestException("AI Horde did not return a generation id.");
    }

    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, attempt < 5 ? 1000 : 3000),
      );
      const statusResponse = await fetch(
        `${baseUrl}/generate/text/status/${submitted.id}`,
        {
          headers: {
            apikey: provider.apiKey || "0000000000",
            "Client-Agent": this.hordeClientAgent(),
          },
        },
      );
      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new BadRequestException(
          `AI Horde status failed: ${statusResponse.status} ${errorText.slice(0, 500)}`,
        );
      }

      const status = (await statusResponse.json()) as {
        done?: boolean;
        faulted?: boolean;
        generations?: Array<{ text?: string }>;
        queue_position?: number;
        wait_time?: number;
      };
      const content = status.generations?.[0]?.text?.trim();
      if (content) {
        return content;
      }
      if (status.faulted) {
        throw new BadRequestException(
          "AI Horde generation faulted before completion.",
        );
      }
    }

    throw new BadRequestException(
      "AI Horde generation timed out; public workers may be busy. Try another model or retry later.",
    );
  }

  private toHordePrompt(messages: ProviderMessage[]) {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const conversation = messages
      .filter((message) => message.role !== "system")
      .map((message) => `User: ${message.content}`)
      .join("\n\n");

    return [system ? `System:\n${system}` : "", conversation, "Assistant:"]
      .filter(Boolean)
      .join("\n\n");
  }

  private hordeClientAgent() {
    return "ai-novel-first-step:0.1.0:https://github.com/myyimu/ai-novel-first-step";
  }

  private hordeMaxLength(requested?: number) {
    const envDefault = Number.parseInt(
      process.env.AI_HORDE_MAX_LENGTH || "",
      10,
    );
    const defaultMax = Number.isFinite(envDefault) ? envDefault : 2048;
    const envCap = Number.parseInt(
      process.env.AI_HORDE_MAX_LENGTH_CAP || "",
      10,
    );
    const cap = Number.isFinite(envCap) ? envCap : 3072;
    const target = requested ?? defaultMax;

    return Math.max(256, Math.min(target, cap));
  }
}
