---
name: prismatic-build-integration
description: Build or update a local Prismatic Code Native Integration (CNI), including its flows, configuration wizard, connections, mappings, tests, and production build. Use whenever a user asks to create an integration, connect systems with Prismatic, implement CNI flows, or turn integration requirements into local code.
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

Prefer existing Prismatic components when they fit, but a direct authenticated
client is equally valid. Expose credentials and customer-owned choices through
the configuration wizard. Do not hard-code tenant IDs, resource selections,
mappings, or secrets.

Design large or incremental workloads so each execution is bounded and progress
is resumable. Ground pagination and checkpoint behavior in the selected API or
component contract, and make retried writes idempotent or define their duplicate
policy. When customer schemas vary, make object and field selection configurable
and test mapping logic without live credentials.

This skill covers local implementation and verification only. Do not import,
deploy, publish, run platform or live-service tests, or mutate Prismatic or
connected services.

Install dependencies and run the generated project's typecheck, lint, tests, and
production build when those scripts exist. Fix failures and report the project
path, architecture, deployer configuration, assumptions, and validation results.
