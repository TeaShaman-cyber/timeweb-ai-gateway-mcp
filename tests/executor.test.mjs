import assert from "node:assert/strict";
import test from "node:test";

import { createExecutor } from "../src/executor.mjs";

test("execute_tool rejects unknown tool IDs before provider access", async () => {
  let providerTouched = false;
  const executor = createExecutor({
    listModels: async () => {
      providerTouched = true;
      return { models: [] };
    },
    modelChat: async () => {
      providerTouched = true;
      return { model: "x", content: "x" };
    },
  });

  await assert.rejects(
    () => executor.execute("not_real", {}),
    /UNKNOWN_TOOL_ID/,
  );
  assert.equal(providerTouched, false);
});

test("execute_tool validates arguments before provider access", async () => {
  let providerTouched = false;
  const executor = createExecutor({
    listModels: async () => {
      providerTouched = true;
      return { models: [] };
    },
    modelChat: async () => {
      providerTouched = true;
      return { model: "x", content: "x" };
    },
  });

  await assert.rejects(
    () =>
      executor.execute("model_chat", {
        model: "",
        messages: [],
      }),
    /INVALID_ARGUMENTS/,
  );
  assert.equal(providerTouched, false);
});
