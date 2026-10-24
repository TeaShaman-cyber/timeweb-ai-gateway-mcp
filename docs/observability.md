# Observability contract

## Status

Architecture invariant for the Timeweb AI Gateway MCP.

This document specifies the minimum end-to-end observability properties required
before the gateway is considered production-ready for agent work. It defines the
evidence model and telemetry contract; it does not select a single mandatory
observability vendor.

## Goal

Make failures attributable across the agent inference path without exposing
credentials or turning prompt/response persistence into a hidden side effect.

Target path:

    ChatGPT
      -> Arcade
      -> Timeweb AI Gateway MCP wrapper
      -> Timeweb AI Gateway
      -> selected model

The design goal is maximum practical observability across these boundaries while
preserving authority, privacy, and runtime separation.

A user-visible failure such as "tool call failed", timeout, malformed response,
or suspicious model output must not collapse all possible causes into one
undifferentiated error.

## First-class invariant

Observability is part of the gateway contract, not an optional deployment add-on.

The implementation must make enough structured evidence available to distinguish,
when the relevant layer is observable:

- ChatGPT/client-side invocation and transport failure;
- Arcade authorization, policy, routing, gateway, or upstream-connection failure;
- MCP wrapper transport, validation, catalog, executor, or internal failure;
- Timeweb API authentication, rate-limit, timeout, network, or upstream failure;
- selected-model generation anomalies after transport/provider execution succeeds;
- unknown or unobservable gaps.

An unavailable layer must remain explicitly UNKNOWN. Telemetry from one runtime
or provider is evidence about that layer only and must not be promoted into proof
about another layer.

## Trace topology

The conceptual trace is:

    trace
    |
    +-- client.tool_call
        |
        +-- arcade.gateway
            |
            +-- mcp.execute_tool
                |
                +-- timeweb.http
                    |
                    +-- model.generation

Where infrastructure permits propagation, the same trace/correlation identity
should cross the boundary.

Where a layer does not expose or forward the identity, the implementation must
record the discontinuity explicitly and preserve bridge identifiers that are
actually observable, for example:

- client request/tool-call identifier;
- Arcade execution/audit identifier;
- MCP request identifier;
- wrapper-generated trace identifier;
- Timeweb/provider request identifier.

A correlation bridge is evidence of association, not proof that hidden layers
performed a particular action.

## Evidence boundaries

### ChatGPT

Can establish what tool/capability was requested and what result/error was
returned to the client when those fields are exposed.

It cannot by itself prove whether Arcade forwarded the call or Timeweb executed
it.

### Arcade

Arcade is a distinct node in the path, not a transparent implementation detail.

Its gateway/audit evidence may establish:

- authorization and policy decisions;
- selected MCP server/tool routing;
- gateway health and transport outcome;
- execution/audit identifiers;
- whether an upstream request was attempted when the surface exposes that fact.

Arcade telemetry must not be treated as equivalent to wrapper or Timeweb
application telemetry.

### MCP wrapper

The wrapper is the primary application-level attribution point.

It should establish:

- received capability ID;
- schema/validation outcome;
- wrapper version or source revision;
- selected model for inference capabilities;
- start/end timestamps and duration;
- normalized execution status/error class;
- whether provider dispatch was attempted;
- retry count;
- provider request identifier when returned;
- bounded usage/cost metadata when returned.

### Timeweb AI Gateway

Provider evidence may establish:

- request acceptance/rejection;
- HTTP/provider status;
- rate-limit and timeout behavior;
- provider-generated request identifiers;
- model ID accepted by the provider;
- usage/cost fields returned by the API.

A successful HTTP response does not prove semantic model correctness.

### Selected model

Model-level attribution begins only after the preceding transport/provider path
is known to have succeeded.

Examples include structurally valid but semantically anomalous output, repeated
empty output, or evaluator/replay failures tied to a selected model.

A "model" failure-domain classification is diagnostic evidence, not automatic
proof of a vendor/model defect. Reproduction or evaluation may still be needed.

## Minimal safe telemetry schema

Baseline telemetry should contain metadata, not conversation payloads.

Required when available:

| Field | Meaning |
| --- | --- |
| trace_id | Wrapper or propagated trace identity |
| request_id | Request identity local to the current layer |
| parent_request_id | Observable parent/bridge request identity |
| capability_id | Internal capability such as model_chat |
| mcp_tool | Top-level MCP tool such as execute_tool |
| model | Explicitly selected provider model, when applicable |
| wrapper_version | Release/version or exact source revision |
| environment | dev/staging/production-style environment label |
| started_at | Request start timestamp |
| duration_ms | Measured duration for the observed leg |
| status | success/error/cancelled/timeout-style normalized status |
| failure_domain | client/arcade/wrapper/timeweb/model/unknown |
| error_class | Stable normalized error class without secrets |
| retry_count | Number of wrapper/provider retries |
| upstream_request_id | Timeweb/provider request ID when exposed |
| input_size | Bounded size/count metadata, not prompt contents |
| output_size | Bounded size/count metadata, not response contents |
| token_usage | Provider-reported usage when available |
| cost | Provider-reported or deterministically derived cost when available |

Optional hashes may be used for diagnostic correlation only when their privacy
properties are understood. A hash is not automatically anonymous.

## Payload and secret policy

Baseline observability must not require storing:

- Timeweb credentials;
- Arcade credentials or authorization material;
- OAuth tokens;
- request Authorization headers;
- complete prompts;
- complete model responses;
- hidden ChatGPT conversation/session state.

Prompt or response capture, if ever enabled for a controlled diagnostic or
evaluation environment, must be an explicit separate policy with bounded
retention and redaction. It must not silently become part of normal inference.

The existing no-hidden-conversation-persistence invariant remains in force.

## Failure-domain classification

The wrapper should normalize failures without pretending to observe layers it
cannot see.

Suggested diagnostic classes:

| failure_domain | Evidence threshold |
| --- | --- |
| client | failure is observed before Arcade/upstream execution evidence exists |
| arcade | Arcade evidence shows authorization/policy/routing/gateway failure before wrapper execution |
| wrapper | wrapper receives the call and fails before provider dispatch, or fails internally |
| timeweb | wrapper dispatches provider request and Timeweb/network/provider transport returns a bounded failure |
| model | provider execution succeeds but generation/output exhibits a reproducible or evaluated anomaly |
| unknown | evidence is insufficient, conflicting, or crosses an unobservable gap |

The classification must preserve UNKNOWN instead of guessing from a generic
HTTP, MCP, or model error.

## Exporters and backends

Telemetry production and telemetry export are separate concerns.

The wrapper should be instrumentable with OpenTelemetry-compatible tracing and
may export application/model traces to Langfuse or another suitable backend.

Exporter failure must be fail-open with respect to inference correctness:

    observability exporter unavailable
        !=
    inference unavailable

Dropping or buffering telemetry may degrade diagnostics, but must not silently
change model selection, tool semantics, authorization, or provider execution.

## Arcade and Langfuse roles

Arcade and Langfuse are complementary evidence surfaces.

Arcade primarily covers the gateway/control path:

    authorization
    policy
    routing
    MCP-server connection
    audit/execution history

Langfuse or another application tracing backend can cover the wrapper/inference
path:

    spans
    provider/model latency
    usage/cost
    normalized errors
    model generations
    evaluations
    replay/comparison

Neither source alone is the canonical explanation of an end-to-end failure.
Correlation between independently observed evidence is preferred.

## Public MCP surface

Observability must not require expanding the public MCP tool manifest.

The searchable control plane remains:

    search_tools -> get_tool_definition -> execute_tool

Tracing is an implementation and runtime concern around those calls. New models
or observability backends do not become new top-level MCP tools merely to make
them visible.

## Implementation acceptance

A future instrumentation slice is complete only when deterministic tests prove
at least:

- a wrapper trace exists for a successful execute_tool call;
- validation failure is classified as wrapper and records no provider dispatch;
- provider timeout/error is classified as timeweb with secrets redacted;
- selected model and capability metadata are attached when applicable;
- exporter failure does not fail an otherwise successful inference call;
- prompt/response bodies are absent from baseline telemetry;
- an unknown/unobservable upstream gap remains explicitly unknown rather than
  being guessed as Arcade, Timeweb, or model failure.

Live deployment acceptance should additionally prove that one request can be
followed through the observable Arcade, wrapper, and provider evidence available
in the deployed path.

