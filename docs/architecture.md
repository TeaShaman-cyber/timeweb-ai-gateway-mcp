# Architecture

## Goal

Expose selected Timeweb AI Gateway inference capabilities to ChatGPT without turning the MCP endpoint into an SDK-sized tool manifest.

## Searchable control plane

The project adopts the same scalable interface pattern proven by the Timeweb Cloud searchable MCP:

    search_tools -> get_tool_definition -> execute_tool

The top-level MCP surface should remain small and stable even as Timeweb adds providers, models, or endpoint families.

Provider/model growth belongs in the capability catalog and live provider model list, not in one new top-level MCP tool per model.

## Initial capability catalog

### list_models

Purpose:
- discover the model IDs currently exposed by Timeweb AI Gateway.

Properties:
- read-only;
- non-billable;
- calls GET /v1/models.

### model_chat

Purpose:
- invoke exactly one explicitly selected generative model.

Properties:
- billable;
- bounded messages and optional generation parameters;
- no hidden conversation persistence;
- no automatic model selection or multi-model fan-out;
- calls POST /v1/chat/completions.

### Jev

Status: UNKNOWN / DEFERRED.

Jev is expected to have materially different typed-decision semantics from free-form generation. No jev_decide capability is exposed until the exact live Timeweb model/API contract is verified.

When verified, Jev should still be added as a catalog capability behind the same searchable discovery / schema / execution control plane, not as an expanding parallel SDK surface.

## Provider boundary

The provider client uses:

    https://api.timeweb.ai/v1

with the separate Timeweb AI Gateway credential plane.

Timeweb Cloud management credentials must never enter this service.

The core intentionally does not persist prompts, responses, sessions, or conversation history.

Provider output is untrusted data.

## Current implementation slice

The first implementation is dependency-free standard Node core:

- deterministic capability search;
- exact capability definition retrieval;
- bounded argument validation;
- fail-closed executor dispatch;
- Timeweb Bearer authentication;
- provider timeout and stable error mapping;
- provider response parsing with no secret echo.

MCP SDK transport, remote HTTPS deployment, and ChatGPT App/plugin binding are separate promotion steps after this core is green.
