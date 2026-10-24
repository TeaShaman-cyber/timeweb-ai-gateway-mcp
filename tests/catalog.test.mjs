import assert from "node:assert/strict";
import test from "node:test";

import {
  getToolDefinition,
  searchTools,
  validateExecutionArguments,
} from "../src/catalog.mjs";

test("search_tools finds model_chat by intent", () => {
  const results = searchTools("chat with a yandex model", 5);
  assert.equal(results[0]?.tool_id, "model_chat");
  assert.equal(results[0]?.confidence, "high");
});

test("search_tools finds list_models by discovery intent", () => {
  const results = searchTools("list available models and providers", 5);
  assert.equal(results[0]?.tool_id, "list_models");
});

test("get_tool_definition returns bounded metadata", () => {
  const def = getToolDefinition("model_chat");
  assert.equal(def.tool_id, "model_chat");
  assert.equal(def.billable, true);
  assert.equal(def.read_only, false);
  assert.equal(def.input_schema.additionalProperties, false);
});

test("unknown tool IDs fail closed", () => {
  assert.throws(() => getToolDefinition("not_real"), /UNKNOWN_TOOL_ID/);
  assert.throws(
    () => validateExecutionArguments("not_real", {}),
    /UNKNOWN_TOOL_ID/,
  );
});

test("model_chat rejects empty model and oversized content", () => {
  assert.throws(
    () =>
      validateExecutionArguments("model_chat", {
        model: "",
        messages: [{ role: "user", content: "hello" }],
      }),
    /INVALID_ARGUMENTS/,
  );

  assert.throws(
    () =>
      validateExecutionArguments("model_chat", {
        model: "provider/model",
        messages: [{ role: "user", content: "x".repeat(20_001) }],
      }),
    /INVALID_ARGUMENTS/,
  );
});
