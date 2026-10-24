import {
  getToolDefinition,
  searchTools,
  validateExecutionArguments
} from "./catalog.mjs";

export function createExecutor(provider) {
  if (
    provider === null ||
    typeof provider !== "object" ||
    typeof provider.listModels !== "function" ||
    typeof provider.modelChat !== "function"
  ) {
    throw new Error(
      "CONFIG_ERROR: provider must implement listModels and modelChat"
    );
  }

  return Object.freeze({
    search(query, limit) {
      return searchTools(query, limit);
    },

    getDefinition(toolId) {
      return getToolDefinition(toolId);
    },

    async execute(toolId, args) {
      const validated = validateExecutionArguments(toolId, args);

      if (toolId === "list_models") {
        return provider.listModels();
      }

      if (toolId === "model_chat") {
        return provider.modelChat(validated);
      }

      throw new Error(`UNKNOWN_TOOL_ID: unknown capability: ${String(toolId)}`);
    }
  });
}
