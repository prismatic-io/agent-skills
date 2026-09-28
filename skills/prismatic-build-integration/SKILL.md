---
name: prismatic-build-integration
description: Build or update a local Prismatic Code Native Integration (CNI), including its flows, configuration wizard, connections, mappings, tests, and production build. Use for new integration requirements and ongoing CNI development. For assessing or replacing an existing non-Prismatic integration system, prefer prismatic-migrate-integration when available.
compatibility: Requires Node.js 22+, npm, Prism 11 on PATH, and network access to documentation and packages.
---

# Build a Prismatic integration

Start from the user's request and current project. Extend the current CNI when
present; otherwise scaffold one with `prism integrations:init <name>`. Use
`prism --llms` and command `--help` or `--schema` to discover current
capabilities. Prefer Prism's generated project and toolchain over custom
scaffolding.

Research the connected services in their official documentation. Use
[Prismatic's CNI docs](https://prismatic.io/docs/integrations/code-native/),
[CNI examples](https://github.com/prismatic-io/examples/tree/main/integrations/code-native),
installed manifest documentation, and installed `@prismatic-io/spectral` public
types for current SDK patterns.

Translate the request into triggers, source and destination operations,
deployer-owned configuration, expected volume, customer-specific mapping, and
retry behavior. Infer technical choices from the service contracts and project.
Ask only about missing business decisions that materially change the result.

Check that the chosen event represents the requested business change; filter a
broader event where supported or explain the limitation. For lifecycle-managed
resources, keep remote IDs tied to their issuing service/account, and check that
repeated setup, changed configuration, and cleanup converge on the intended
resources without affecting unrelated ones. When requests are idempotent, key or
reconcile them according to the desired operation and its change semantics. Use
documented provider-managed guarantees where sufficient; report cleanup limits
when access is unavailable.

Prefer existing Prismatic components when they fit, but a direct authenticated
client is equally valid. Expose credentials and customer-owned choices through
the configuration wizard. Do not hard-code tenant IDs, resource selections,
mappings, or secrets.

Design large or incremental workloads so each execution is bounded and progress
is resumable. Ground pagination and checkpoint behavior in the selected API or
component contract, and make retried writes idempotent or define their duplicate
policy. When customer schemas vary, make object and field selection configurable
and test mapping logic without live credentials.

For a reused trigger or client, verify the selected operation's contract from
official documentation and the installed interface. Derive representative local
checks from that contract, preserving response wrappers, wire types, and
continuation data while keeping relevant request construction under test. Where
event selection or persisted progress matters, check recovery after downstream
failure. If an abstraction omits information the request needs, use a supported
boundary that exposes it; when constructing queries, follow the provider's literal
rules.

This skill covers local implementation and verification only. Do not import,
deploy, publish, run platform or live-service tests, or mutate Prismatic or
connected services.

Install dependencies and run the generated project's typecheck, lint, tests, and
production build when those scripts exist. After building, load the compiled
integration locally with the installed SDK to catch registration errors that
typechecking and bundling can miss. For lifecycle hooks or polling triggers,
consult [SDK registration boundaries](references/registration.md).
Fix failures and report the project path,
architecture, deployer configuration, assumptions, and validation results.
