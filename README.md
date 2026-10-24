# Timeweb AI Gateway MCP

Public infrastructure repository for ChatGPT integrations with Timeweb.

This repository documents two deliberately separate Timeweb planes:

1. **Timeweb Cloud management** — an already-working ChatGPT plugin for infrastructure/account operations through the official Timeweb Cloud MCP.
2. **Timeweb AI Gateway inference** — a separate MCP wrapper under development for bounded model access such as model_chat(...) and, once verified, Jev-style typed decisions.

The credential planes must remain separate. Timeweb Cloud management credentials do not belong in the AI Gateway wrapper, and AI Gateway credentials do not belong in the management plugin.

## Current status

- Timeweb Cloud management plugin: **VERIFIED / MANAGEMENT_INTEGRATION_DONE**.
- Timeweb AI Gateway inference plugin: **BOOTSTRAP / issue #1**.
- Public repository + DevOps baseline: tracked in **issue #2**.

See:
- [Completed Timeweb Cloud plugin](docs/timeweb-cloud-plugin.md)
- [Repository DevOps cycle](docs/devops-cycle.md)

## Development

All non-trivial changes follow the repository cycle documented in docs/devops-cycle.md.

Run the deterministic local gate:

    tools/dev/check

Do not commit provider tokens, OAuth secrets, API keys, account-specific inventory, or generated credential material.


## Observability

The inference gateway is designed to be observable across the full agent path:

    ChatGPT -> Arcade -> MCP wrapper -> Timeweb AI Gateway -> selected model

Observability is part of the architecture contract. The wrapper must support
correlation and bounded failure attribution without requiring prompt/response
logging or exposing credentials, and telemetry-export failure must not break
inference. See [docs/observability.md](docs/observability.md).

