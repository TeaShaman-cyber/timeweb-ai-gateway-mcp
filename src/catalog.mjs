const MAX_SEARCH_RESULTS = 10;
const MAX_MODEL_LENGTH = 200;
const MAX_MESSAGES = 32;
const MAX_MESSAGE_LENGTH = 20_000;
const MAX_TOTAL_MESSAGE_LENGTH = 50_000;
const MAX_TOKENS = 32_768;

const DEFINITIONS = Object.freeze({
  list_models: Object.freeze({
    tool_id: "list_models",
    title: "List available AI Gateway models",
    description:
      "List the model identifiers currently exposed by the Timeweb AI Gateway.",
    read_only: true,
    billable: false,
    keywords: Object.freeze([
      "list",
      "models",
      "model",
      "available",
      "providers",
      "provider",
      "catalog",
      "discover",
      "модели",
      "провайдеры"
    ]),
    input_schema: Object.freeze({
      type: "object",
      additionalProperties: false,
      properties: Object.freeze({})
    })
  }),
  model_chat: Object.freeze({
    tool_id: "model_chat",
    title: "Run a bounded chat completion",
    description:
      "Invoke one explicitly selected Timeweb AI Gateway generative model with bounded chat messages.",
    read_only: false,
    billable: true,
    keywords: Object.freeze([
      "chat",
      "generate",
      "generation",
      "completion",
      "message",
      "model",
      "yandex",
      "yandexgpt",
      "alice",
      "qwen",
      "deepseek",
      "claude",
      "gemini",
      "чат",
      "генерация"
    ]),
    input_schema: Object.freeze({
      type: "object",
      additionalProperties: false,
      required: Object.freeze(["model", "messages"]),
      properties: Object.freeze({
        model: Object.freeze({
          type: "string",
          minLength: 1,
          maxLength: MAX_MODEL_LENGTH
        }),
        messages: Object.freeze({
          type: "array",
          minItems: 1,
          maxItems: MAX_MESSAGES,
          items: Object.freeze({
            type: "object",
            additionalProperties: false,
            required: Object.freeze(["role", "content"]),
            properties: Object.freeze({
              role: Object.freeze({
                type: "string",
                enum: Object.freeze(["system", "user", "assistant"])
              }),
              content: Object.freeze({
                type: "string",
                minLength: 1,
                maxLength: MAX_MESSAGE_LENGTH
              })
            })
          })
        }),
        temperature: Object.freeze({
          type: "number",
          minimum: 0,
          maximum: 2
        }),
        max_tokens: Object.freeze({
          type: "integer",
          minimum: 1,
          maximum: MAX_TOKENS
        })
      })
    })
  })
});

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`);
}

function assertPlainObject(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    fail("INVALID_ARGUMENTS", `${label} must be an object`);
  }
}

function assertAllowedKeys(value, allowed, label) {
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  if (extras.length > 0) {
    fail(
      "INVALID_ARGUMENTS",
      `${label} contains unsupported fields: ${extras.join(", ")}`
    );
  }
}

function scoreDefinition(definition, normalizedQuery) {
  let score = 0;
  const haystack = [
    definition.tool_id,
    definition.title,
    definition.description,
    ...definition.keywords
  ]
    .join(" ")
    .toLowerCase();

  for (const keyword of definition.keywords) {
    if (normalizedQuery.includes(keyword.toLowerCase())) {
      score += 2;
    }
  }

  for (const token of normalizedQuery.split(/\s+/u).filter(Boolean)) {
    if (token.length >= 3 && haystack.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function publicDefinition(definition) {
  const { keywords: _keywords, ...visible } = definition;
  return structuredClone(visible);
}

export function searchTools(query, limit = 5) {
  if (typeof query !== "string" || query.trim().length === 0) {
    fail("INVALID_ARGUMENTS", "query must be a non-empty string");
  }
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_SEARCH_RESULTS
  ) {
    fail(
      "INVALID_ARGUMENTS",
      `limit must be an integer between 1 and ${MAX_SEARCH_RESULTS}`
    );
  }

  const normalized = query.trim().toLowerCase();
  return Object.values(DEFINITIONS)
    .map((definition) => ({
      definition,
      score: scoreDefinition(definition, normalized)
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.definition.tool_id.localeCompare(b.definition.tool_id))
    .slice(0, limit)
    .map(({ definition, score }) => ({
      tool_id: definition.tool_id,
      title: definition.title,
      description: definition.description,
      confidence: score >= 4 ? "high" : score >= 2 ? "medium" : "low"
    }));
}

export function getToolDefinition(toolId) {
  const definition = DEFINITIONS[toolId];
  if (!definition) {
    fail("UNKNOWN_TOOL_ID", `unknown capability: ${String(toolId)}`);
  }
  return publicDefinition(definition);
}

export function validateExecutionArguments(toolId, args) {
  getToolDefinition(toolId);
  assertPlainObject(args, "arguments");

  if (toolId === "list_models") {
    assertAllowedKeys(args, new Set(), "arguments");
    return {};
  }

  if (toolId !== "model_chat") {
    fail("UNKNOWN_TOOL_ID", `unknown capability: ${String(toolId)}`);
  }

  assertAllowedKeys(
    args,
    new Set(["model", "messages", "temperature", "max_tokens"]),
    "arguments"
  );

  if (
    typeof args.model !== "string" ||
    args.model.trim().length === 0 ||
    args.model.trim().length > MAX_MODEL_LENGTH
  ) {
    fail(
      "INVALID_ARGUMENTS",
      `model must be a non-empty string up to ${MAX_MODEL_LENGTH} characters`
    );
  }

  if (
    !Array.isArray(args.messages) ||
    args.messages.length < 1 ||
    args.messages.length > MAX_MESSAGES
  ) {
    fail(
      "INVALID_ARGUMENTS",
      `messages must contain between 1 and ${MAX_MESSAGES} entries`
    );
  }

  let totalLength = 0;
  const messages = args.messages.map((message, index) => {
    assertPlainObject(message, `messages[${index}]`);
    assertAllowedKeys(
      message,
      new Set(["role", "content"]),
      `messages[${index}]`
    );

    if (!["system", "user", "assistant"].includes(message.role)) {
      fail(
        "INVALID_ARGUMENTS",
        `messages[${index}].role must be system, user, or assistant`
      );
    }

    if (
      typeof message.content !== "string" ||
      message.content.length < 1 ||
      message.content.length > MAX_MESSAGE_LENGTH
    ) {
      fail(
        "INVALID_ARGUMENTS",
        `messages[${index}].content must contain 1..${MAX_MESSAGE_LENGTH} characters`
      );
    }

    totalLength += message.content.length;
    return {
      role: message.role,
      content: message.content
    };
  });

  if (totalLength > MAX_TOTAL_MESSAGE_LENGTH) {
    fail(
      "INVALID_ARGUMENTS",
      `total message content exceeds ${MAX_TOTAL_MESSAGE_LENGTH} characters`
    );
  }

  const normalized = {
    model: args.model.trim(),
    messages
  };

  if (args.temperature !== undefined) {
    if (
      typeof args.temperature !== "number" ||
      !Number.isFinite(args.temperature) ||
      args.temperature < 0 ||
      args.temperature > 2
    ) {
      fail("INVALID_ARGUMENTS", "temperature must be between 0 and 2");
    }
    normalized.temperature = args.temperature;
  }

  if (args.max_tokens !== undefined) {
    if (
      !Number.isInteger(args.max_tokens) ||
      args.max_tokens < 1 ||
      args.max_tokens > MAX_TOKENS
    ) {
      fail(
        "INVALID_ARGUMENTS",
        `max_tokens must be an integer between 1 and ${MAX_TOKENS}`
      );
    }
    normalized.max_tokens = args.max_tokens;
  }

  return normalized;
}
