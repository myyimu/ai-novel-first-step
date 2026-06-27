import { ModelProviderService } from "./model-provider.service";

describe("ModelProviderService shared-gpu fallback", () => {
  const originalFetch = global.fetch;
  const originalSetTimeout = global.setTimeout;

  afterEach(() => {
    global.fetch = originalFetch;
    global.setTimeout = originalSetTimeout;
    delete process.env.SHARED_GPU_BASE_URL;
    delete process.env.SHARED_GPU_MODEL;
    delete process.env.SHARED_GPU_API_KEY;
    delete process.env.SHARED_GPU_JSON_MODE;
    delete process.env.PROVIDER_REQUEST_TIMEOUT_MS;
    jest.restoreAllMocks();
  });

  it("uses the anonymous fallback when shared-gpu env is not configured", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "job-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          done: true,
          faulted: false,
          generations: [{ text: '{"ok":true}' }],
        }),
      });
    global.fetch = fetchMock as never;
    jest.spyOn(global, "setTimeout").mockImplementation(((
      callback: (...args: unknown[]) => void,
    ) => {
      callback();
      return 0 as never;
    }) as unknown as typeof setTimeout);

    const service = new ModelProviderService();
    const result = await service.chat(
      {
        preset: "shared-gpu",
        kind: "openai-compatible",
        baseUrl: "",
        apiKey: "",
        model: "",
        temperature: 0.2,
        jsonMode: false,
      },
      [{ role: "user", content: "请返回 JSON" }],
      { maxOutputTokens: 128 },
    );

    expect(result).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledWith(
      "https://aihorde.net/api/v2/generate/text/async",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "0000000000",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://aihorde.net/api/v2/generate/text/status/job-1",
      expect.any(Object),
    );
  });

  it("sends json_schema response_format for OpenAI-compatible providers that support it", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    });
    global.fetch = fetchMock as never;

    const service = new ModelProviderService();
    const result = await service.chat(
      {
        preset: "custom",
        kind: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-test",
        temperature: 0.2,
        jsonMode: false,
      },
      [{ role: "user", content: "请返回 JSON" }],
      {
        maxOutputTokens: 128,
        jsonSchema: {
          name: "ok_result",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { ok: { type: "boolean" } },
            required: ["ok"],
          },
        },
      },
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(result).toBe('{"ok":true}');
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "ok_result",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
      },
    });
  });

  it("rejects custom provider URLs that point to localhost", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as never;

    const service = new ModelProviderService();

    await expect(
      service.chat(
        {
          preset: "custom",
          kind: "openai-compatible",
          baseUrl: "http://127.0.0.1:8080/v1",
          apiKey: "sk-test",
          model: "local-test",
          temperature: 0.2,
          jsonMode: false,
        },
        [{ role: "user", content: "hello" }],
      ),
    ).rejects.toThrow("https");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows the Ollama preset to call the local default endpoint", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    });
    global.fetch = fetchMock as never;

    const service = new ModelProviderService();
    const result = await service.chat(
      {
        preset: "ollama",
        kind: "openai-compatible",
        baseUrl: "http://localhost:11434/v1",
        apiKey: "",
        model: "qwen2.5:7b",
        temperature: 0.2,
        jsonMode: false,
      },
      [{ role: "user", content: "hello" }],
    );

    expect(result).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/v1/chat/completions",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("accepts OpenAI-compatible content parts arrays", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                { type: "text", text: '{"ok":' },
                { type: "text", text: "true}" },
              ],
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as never;

    const service = new ModelProviderService();
    const result = await service.chat(
      {
        preset: "custom",
        kind: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-test",
        temperature: 0.2,
        jsonMode: false,
      },
      [{ role: "user", content: "hello" }],
    );

    expect(result).toBe('{"ok":true}');
  });

  it("uses reasoning_content when OpenAI-compatible providers return empty message content", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: null,
              reasoning_content: '{"ok":true}',
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as never;

    const service = new ModelProviderService();
    const result = await service.chat(
      {
        preset: "custom",
        kind: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-test",
        temperature: 0.2,
        jsonMode: false,
      },
      [{ role: "user", content: "请返回 JSON" }],
      {
        jsonSchema: {
          name: "ok_result",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { ok: { type: "boolean" } },
            required: ["ok"],
          },
        },
      },
    );

    expect(result).toBe('{"ok":true}');
  });

  it("appends reasoning_content as think text for non-JSON responses", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: "最终回答",
              reasoning_content: "推理过程",
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as never;

    const service = new ModelProviderService();
    const result = await service.chat(
      {
        preset: "custom",
        kind: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-test",
        temperature: 0.2,
        jsonMode: false,
      },
      [{ role: "user", content: "hello" }],
    );

    expect(result).toBe("<think>\n推理过程\n</think>\n最终回答");
  });

  it("keeps JSON content clean when reasoning_content is also present", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: '{"ok":true}',
              reasoning_content: "推理过程",
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as never;

    const service = new ModelProviderService();
    const result = await service.chat(
      {
        preset: "custom",
        kind: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-test",
        temperature: 0.2,
        jsonMode: false,
      },
      [{ role: "user", content: "请返回 JSON" }],
      {
        jsonSchema: {
          name: "ok_result",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { ok: { type: "boolean" } },
            required: ["ok"],
          },
        },
      },
    );

    expect(result).toBe('{"ok":true}');
  });

  it("reports provider response shape when message content is missing", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: "content_filter",
            message: { refusal: "blocked" },
          },
        ],
      }),
    });
    global.fetch = fetchMock as never;

    const service = new ModelProviderService();

    await expect(
      service.chat(
        {
          preset: "custom",
          kind: "openai-compatible",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-test",
          model: "gpt-test",
          temperature: 0.2,
          jsonMode: false,
        },
        [{ role: "user", content: "hello" }],
      ),
    ).rejects.toThrow(
      "Provider response did not include message content. finish_reason=content_filter",
    );
  });

  it("retries with a larger output budget when the provider returns length without content", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              finish_reason: "length",
              message: {
                content: null,
                reasoning_content: "still thinking",
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            { finish_reason: "stop", message: { content: '{"ok":true}' } },
          ],
        }),
      });
    global.fetch = fetchMock as never;

    const service = new ModelProviderService();
    const result = await service.chat(
      {
        preset: "custom",
        kind: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-test",
        temperature: 0.2,
        jsonMode: false,
      },
      [{ role: "user", content: "请返回 JSON" }],
      { maxOutputTokens: 900 },
    );

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(result).toBe('{"ok":true}');
    expect(firstBody.max_tokens).toBe(900);
    expect(secondBody.max_tokens).toBe(4096);
  });

  it("returns partial provider text when the response is still length-limited after retry", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: "length",
            message: {
              content: '{"partial":true',
              reasoning_content: "still thinking",
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as never;

    const service = new ModelProviderService();

    const result = await service.chat(
      {
        preset: "custom",
        kind: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-test",
        temperature: 0.2,
        jsonMode: false,
      },
      [{ role: "user", content: "请返回 JSON" }],
      { maxOutputTokens: 3000 },
    );

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(result).toBe('{"partial":true');
    expect(firstBody.max_tokens).toBe(3000);
    expect(secondBody.max_tokens).toBe(8192);
  });

  it("reports a readable truncation error when a length-limited response has no text at all", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: "length",
            message: {
              content: null,
              reasoning_content: "",
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as never;

    const service = new ModelProviderService();

    await expect(
      service.chat(
        {
          preset: "custom",
          kind: "openai-compatible",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-test",
          model: "gpt-test",
          temperature: 0.2,
          jsonMode: false,
        },
        [{ role: "user", content: "请返回 JSON" }],
        { maxOutputTokens: 3000 },
      ),
    ).rejects.toThrow("模型输出被截断，Provider 没有返回完整可用正文");
  });

  it("falls back when json_schema is rejected by an OpenAI-compatible provider", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "unsupported response_format",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"ok":true}' } }],
        }),
      });
    global.fetch = fetchMock as never;

    const service = new ModelProviderService();
    const result = await service.chat(
      {
        preset: "custom",
        kind: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-test",
        temperature: 0.2,
        jsonMode: true,
      },
      [{ role: "user", content: "请返回 JSON" }],
      {
        maxOutputTokens: 128,
        jsonSchema: {
          name: "ok_result",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { ok: { type: "boolean" } },
            required: ["ok"],
          },
        },
      },
    );

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(result).toBe('{"ok":true}');
    expect(firstBody.response_format.type).toBe("json_schema");
    expect(secondBody.response_format).toEqual({ type: "json_object" });
  });
});
