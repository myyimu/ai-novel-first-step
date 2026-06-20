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
