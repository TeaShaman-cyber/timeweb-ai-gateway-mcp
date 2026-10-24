import assert from "node:assert/strict";
import test from "node:test";

import {
  createMcpServer,
  registerSearchableTools,
} from "../src/mcp-server.mjs";

class FakeServer {
  registrations = [];

  registerTool(name, config, handler) {
    this.registrations.push({ name, config, handler });
  }
}

function fakeExecutor() {
  return {
    search(query, limit) {
      return [{ tool_id: "model_chat", query, limit }];
    },
    getDefinition(toolId) {
      return { tool_id: toolId, input_schema: { type: "object" } };
    },
    async execute(toolId, args) {
      return { tool_id: toolId, args, ok: true };
    },
  };
}

test("registerSearchableTools exposes exactly three top-level tools", () => {
  const server = new FakeServer();
  registerSearchableTools(server, fakeExecutor());

  assert.deepEqual(
    server.registrations.map((entry) => entry.name),
    ["search_tools", "get_tool_definition", "execute_tool"],
  );
});

test("search and definition tools are read-only while execute is not", () => {
  const server = new FakeServer();
  registerSearchableTools(server, fakeExecutor());

  const byName = Object.fromEntries(
    server.registrations.map((entry) => [entry.name, entry]),
  );

  assert.equal(byName.search_tools.config.annotations.readOnlyHint, true);
  assert.equal(
    byName.get_tool_definition.config.annotations.readOnlyHint,
    true,
  );
  assert.equal(byName.execute_tool.config.annotations.readOnlyHint, false);
  assert.equal(byName.execute_tool.config.annotations.destructiveHint, false);
});

test("handlers preserve structured searchable-control-plane envelopes", async () => {
  const server = new FakeServer();
  registerSearchableTools(server, fakeExecutor());
  const byName = Object.fromEntries(
    server.registrations.map((entry) => [entry.name, entry]),
  );

  const search = await byName.search_tools.handler({
    query: "chat yandex",
    limit: 3,
  });
  assert.deepEqual(search.structuredContent, {
    results: [{ tool_id: "model_chat", query: "chat yandex", limit: 3 }],
  });

  const definition = await byName.get_tool_definition.handler({
    tool_id: "model_chat",
  });
  assert.equal(definition.structuredContent.definition.tool_id, "model_chat");

  const execute = await byName.execute_tool.handler({
    tool_id: "model_chat",
    arguments: {
      model: "yandexgpt/test",
      messages: [{ role: "user", content: "hi" }],
    },
  });
  assert.equal(execute.structuredContent.tool_id, "model_chat");
  assert.equal(execute.structuredContent.result.ok, true);
});

test("createMcpServer builds a real MCP server without expanding the tool surface", () => {
  const server = createMcpServer({ executor: fakeExecutor() });
  assert.ok(server);
  assert.equal(typeof server.connect, "function");
});
