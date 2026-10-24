# Timeweb Cloud ChatGPT plugin

Status: **VERIFIED / MANAGEMENT_INTEGRATION_DONE**

This document describes the already-completed Timeweb Cloud management plugin. The implementation work and detailed receipts were originally carried out in:

https://github.com/TeaShaman-cyber/theseus-local-lab/issues/36

That issue remains the provenance record for creation and acceptance. This repository is now the better long-term documentation home because the plugin is part of the same Timeweb integration infrastructure as the separate AI Gateway workstream.

## Purpose

The Timeweb Cloud plugin exposes infrastructure and account management capabilities to ChatGPT without exposing the provider credential to ChatGPT itself.

Verified live route:

    ChatGPT web
      -> Arcade OAuth gateway
      -> official Timeweb Cloud MCP
      -> Timeweb Cloud management API

Official Timeweb Cloud searchable MCP endpoint used during integration:

    https://api.timeweb.cloud/api/v1/mcp/search

The management credential is a Timeweb Cloud account/API-Terraform token stored as a server-side Arcade header secret. Its value is not committed, logged, or documented here.

## ChatGPT tool surface

The verified direct surface contains four searchable-MCP meta-tools:

- TimewebCloudSearch.search_tools
- TimewebCloudSearch.get_tool_definition
- TimewebCloudSearch.execute_tool
- TimewebCloudSearch.request_user_confirmation

Normal operation follows:

    search_tools -> get_tool_definition -> execute_tool

Tool IDs and schemas are discovered live. They must not be guessed from memory.

## Upstream skills

The current ChatGPT plugin release is version 1.0.1.

It bundles the official Timeweb Cloud skill set from:

https://github.com/timeweb-cloud/skills

Pinned upstream commit:

    a8e497a9faefdb394f1d5ec6b046c28344f40cde

Installed official domain skills:

- timeweb-servers
- timeweb-billing
- timeweb-ai
- timeweb-kubernetes
- timeweb-databases
- timeweb-s3
- timeweb-account
- timeweb-domains
- timeweb-network
- timeweb-apps

Their upstream reference files are bundled with them.

A thin local adapter, timeweb-cloud-arcade-usage, maps the official workflow onto the ChatGPT/Arcade route while preserving provider semantics.

## Safety semantics

The plugin preserves Timeweb's own execution model:

- read the live tool schema before execution;
- never invent a tool_id or arguments;
- use live catalog/pricing data before billable actions;
- treat the first write/billable execution as a proposal;
- present operation_summary and stop when a confirm_token is returned;
- execute the second step only after explicit user approval, with identical arguments and the exact token;
- if arguments change or the token expires, restart the confirmation flow;
- treat not_exposed as terminal rather than seeking undocumented workarounds.

request_user_confirmation does not replace explicit user approval.

## Verification status

The management integration has been verified at all intended layers:

- Timeweb remote MCP registration;
- dedicated Arcade gateway;
- ChatGPT App-backed connection;
- direct searchable tool surface;
- official upstream skills + local adapter;
- read-only routing and provider execution.

The final read-only acceptance covered account state, finances/costs, projects, VDS, DBaaS, Kubernetes, S3, domains, VPC, and App Platform without calling write or billable tools.

Account-specific values and resource identifiers are intentionally not reproduced in this public repository.

## Credential boundary

The Timeweb AI Gateway is a **separate credential plane**.

Management plane:

    Timeweb Cloud plugin
    = infrastructure/account control
    = Timeweb Cloud API credential

Inference plane:

    Timeweb AI Gateway plugin
    = model inference
    = separate AI Gateway credential

The two credentials must never be reused across these surfaces.
