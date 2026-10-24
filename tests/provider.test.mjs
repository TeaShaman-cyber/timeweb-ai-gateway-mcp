import assert from "node:assert/strict";
import test from "node:test";

import { TimewebAiGatewayClient } from "../src/provider.mjs";

const KEY = "tw_test_secret_value_that_must_never_leak";

test("listModels injects bearer auth and parses model IDs", async () => {
  let seenAuth = "";
  const fetchImpl = async (_input, init) => {
    const headers = new Headers(init?.headers);
    seenAuth = headers.get("authorization") ?? "";
    return new Response(
      JSON.stringify({
        object: "list",
        data: [
          { id: "yandexgpt/test", object: "model", owned_by: "timeweb" },
          { id: "qwen/test", object: "model", owned_by: "timeweb" },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const client = new TimewebAiGatewayClient({
    apiKey: KEY,
    fetchImpl,
  });

  const result = await client.listModels();

  assert.equal(seenAuth, `Bearer ${KEY}`);
  assert.deepEqual(
    result.models.map((m) => m.id),
    ["yandexgpt/test", "qwen/test"],
  );
});

test("modelChat sends explicit model/messages and parses bounded output", async () => {
  let requestBody;
  const fetchImpl = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        id: "chatcmpl_1",
        model: "yandexgpt/test",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: { role: "assistant", content: "Привет" },
          },
        ],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const client = new TimewebAiGatewayClient({ apiKey: KEY, fetchImpl });
  const result = await client.modelChat({
    model: "yandexgpt/test",
    messages: [{ role: "user", content: "Привет" }],
  });

  assert.deepEqual(requestBody, {
    model: "yandexgpt/test",
    messages: [{ role: "user", content: "Привет" }],
  });
  assert.equal(result.content, "Привет");
  assert.equal(result.model, "yandexgpt/test");
  assert.equal(result.usage?.total_tokens, 5);
});

test("provider errors map to stable codes without leaking the API key", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        error: {
          message: `bad credential ${KEY}`,
        },
      }),
      { status: 401, headers: { "content-type": "application/json" } },
    );

  const client = new TimewebAiGatewayClient({ apiKey: KEY, fetchImpl });

  await assert.rejects(
    () => client.listModels(),
    (error) => {
      const text = String(error);
      assert.match(text, /PROVIDER_AUTH/);
      assert.doesNotMatch(text, new RegExp(KEY));
      return true;
    },
  );
});

test("timeouts map to PROVIDER_TIMEOUT and redact secrets", async () => {
  const fetchImpl = async (_input, init) => {
    await new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new Error(`aborted ${KEY}`)),
      );
    });
    throw new Error("unreachable");
  };

  const client = new TimewebAiGatewayClient({
    apiKey: KEY,
    fetchImpl,
    timeoutMs: 5,
  });

  await assert.rejects(
    () => client.listModels(),
    (error) => {
      const text = String(error);
      assert.match(text, /PROVIDER_TIMEOUT/);
      assert.doesNotMatch(text, new RegExp(KEY));
      return true;
    },
  );
});
