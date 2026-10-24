const DEFAULT_BASE_URL = "https://api.timeweb.ai/v1";
const DEFAULT_TIMEOUT_MS = 30_000;

export class ProviderError extends Error {
  constructor(code, message, status) {
    super(`${code}: ${message}`);
    this.name = "ProviderError";
    this.code = code;
    if (status !== undefined) {
      this.status = status;
    }
  }
}

function responseCode(status) {
  if (status === 401 || status === 403) return "PROVIDER_AUTH";
  if (status === 429) return "PROVIDER_RATE_LIMIT";
  if ([400, 404, 409, 422].includes(status)) return "PROVIDER_REQUEST";
  if (status >= 500) return "PROVIDER_UPSTREAM";
  return "PROVIDER_ERROR";
}

function safeUsage(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const fields = ["prompt_tokens", "completion_tokens", "total_tokens"];
  const usage = {};
  for (const field of fields) {
    const fieldValue = value[field];
    if (Number.isInteger(fieldValue) && fieldValue >= 0) {
      usage[field] = fieldValue;
    }
  }

  return Object.keys(usage).length > 0 ? usage : undefined;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (text.length === 0) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError(
      "PROVIDER_RESPONSE",
      "Timeweb AI Gateway returned malformed JSON",
      response.status
    );
  }
}

export class TimewebAiGatewayClient {
  constructor({
    apiKey,
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS
  }) {
    if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
      throw new ProviderError(
        "CONFIG_ERROR",
        "Timeweb AI Gateway API key is required"
      );
    }
    if (typeof fetchImpl !== "function") {
      throw new ProviderError("CONFIG_ERROR", "fetch implementation is required");
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
      throw new ProviderError(
        "CONFIG_ERROR",
        "timeoutMs must be an integer between 1 and 120000"
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = String(baseUrl).replace(/\/+$/u, "");
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(path, { method = "GET", body } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${this.apiKey}`
    });

    let requestBody;
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
      requestBody = JSON.stringify(body);
    }

    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal
      });
    } catch {
      if (controller.signal.aborted) {
        throw new ProviderError(
          "PROVIDER_TIMEOUT",
          "Timeweb AI Gateway request timed out"
        );
      }
      throw new ProviderError(
        "PROVIDER_NETWORK",
        "Timeweb AI Gateway network request failed"
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const code = responseCode(response.status);
      throw new ProviderError(
        code,
        `Timeweb AI Gateway request failed with HTTP ${response.status}`,
        response.status
      );
    }

    return parseJsonResponse(response);
  }

  async listModels() {
    const payload = await this.request("/models");
    if (!Array.isArray(payload.data)) {
      throw new ProviderError(
        "PROVIDER_RESPONSE",
        "Timeweb AI Gateway model list is missing data[]"
      );
    }

    const models = payload.data
      .filter(
        (entry) =>
          entry !== null &&
          typeof entry === "object" &&
          typeof entry.id === "string" &&
          entry.id.length > 0
      )
      .map((entry) => {
        const model = { id: entry.id };
        if (typeof entry.owned_by === "string" && entry.owned_by.length > 0) {
          model.owned_by = entry.owned_by;
        }
        return model;
      });

    return { models };
  }

  async modelChat(args) {
    const payload = await this.request("/chat/completions", {
      method: "POST",
      body: args
    });

    const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
    const content = choice?.message?.content;
    if (typeof content !== "string") {
      throw new ProviderError(
        "PROVIDER_RESPONSE",
        "Timeweb AI Gateway chat response is missing textual assistant content"
      );
    }

    const result = {
      model:
        typeof payload.model === "string" && payload.model.length > 0
          ? payload.model
          : args.model,
      content
    };

    if (typeof payload.id === "string" && payload.id.length > 0) {
      result.id = payload.id;
    }
    if (typeof choice.finish_reason === "string") {
      result.finish_reason = choice.finish_reason;
    }

    const usage = safeUsage(payload.usage);
    if (usage !== undefined) {
      result.usage = usage;
    }

    return result;
  }
}
