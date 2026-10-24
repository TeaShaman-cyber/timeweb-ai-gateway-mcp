import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

function toolResult(structuredContent) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(structuredContent),
      },
    ],
    structuredContent,
  };
}

export function registerSearchableTools(server, executor) {
  server.registerTool(
    "search_tools",
    {
      title: "Search AI Gateway capabilities",
      description:
        "Search the bounded Timeweb AI Gateway capability catalog by action or resource intent.",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ query, limit }) =>
      toolResult({
        results: executor.search(query, limit),
      }),
  );

  server.registerTool(
    "get_tool_definition",
    {
      title: "Get AI Gateway capability definition",
      description:
        "Retrieve the exact schema and metadata for one discovered AI Gateway capability.",
      inputSchema: z.object({
        tool_id: z.string().min(1),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ tool_id }) =>
      toolResult({
        definition: executor.getDefinition(tool_id),
      }),
  );

  server.registerTool(
    "execute_tool",
    {
      title: "Execute AI Gateway capability",
      description:
        "Execute one explicitly selected AI Gateway capability with validated arguments.",
      inputSchema: z.object({
        tool_id: z.string().min(1),
        arguments: z.record(z.string(), z.unknown()),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async ({ tool_id, arguments: args }) =>
      toolResult({
        tool_id,
        result: await executor.execute(tool_id, args),
      }),
  );

  return server;
}

export function createMcpServer({
  executor,
  name = "timeweb-ai-gateway-mcp",
  version = "0.1.0",
} = {}) {
  const server = new McpServer({ name, version });
  registerSearchableTools(server, executor);
  return server;
}
