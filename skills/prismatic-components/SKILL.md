---
name: prismatic-components
description: Build and update Prismatic custom connectors (components), including connections, actions, and triggers for use in low-code integrations. Use when a user needs a connector for a service or changes to an existing component.
compatibility: Requires Node.js 22+, npm, Prism CLI 11 or later on PATH, and network access to documentation and packages. Publishing and platform tests also require Prismatic authentication.
---

# Prismatic components

A custom connector is a Spectral TypeScript component whose connections, actions,
and triggers appear in Prismatic's low-code designer.

Start from the user's request and the current project. Extend an existing
component when present, preserving existing keys and behavior outside the requested
change; otherwise scaffold with `prism components init <name>`.
Use `prism --llms` and command `--help` or `--schema` to discover capabilities and
options, including OpenAPI generation. Prefer Prism's commands and generated
toolchain over custom scaffolding or publishing scripts.
Treat generated code as a starting point: keep actions that serve the requested
workflow, remove unrelated generated actions and unused supporting code, and
shape labels, inputs, and outputs around the builder's task. Do not retain the
whole API merely because it was generated. When editing, preserve existing
integration contracts unless the user requests their removal.

Research the service's official documentation for the requested operations and
verify claims about unsupported capabilities against those sources.
Use `prism components search` and `prism components get` to find existing
connectors and the designer-facing shape of comparable actions, triggers, and
connections. Use [Prismatic's connector docs](https://prismatic.io/docs/custom-connectors/)
and [production components](https://github.com/prismatic-io/components/tree/main/components)
for SDK conventions and relevant examples. An existing connector can inform a
custom implementation without replacing the user's request. When documentation
does not cover a capability, inspect the installed Spectral types and relevant
SDK source rather than guessing its contract.

Infer technical choices from the documentation and project. Ask only about
missing business requirements that change the result, in terms the user can
answer. Continue independent work while those details are unresolved.

Expose credentials through Spectral connections, and operations through labeled
inputs and outputs usable in the designer. Implement the requested trigger using
the service's supported event or polling mechanism, including setup and state
needed across executions. Verify endpoints and payload fields against service
docs or SDK source; if a mechanism cannot be verified, use a supported alternative.

Derive tests from each requested behavior and the service contract, including
boundary values and relevant failures. For API operations, mock the HTTP transport
or service, keeping authentication, serialization, and SDK wrappers under test.
Assert outgoing requests, returned data, and an API failure; where relevant, cover
omitted optional values, mixed JSON value types, and fields that should be excluded. For file transfers, check
non-text binary bytes; for triggers, check repeated events or polls. For edits,
rerun existing tests and verify the new behavior. Verify designer features through
the registered metadata, including required versus optional fields and references
between inputs and data sources. Discover Prism's member-inspection commands with
`--help` or `--schema` to check the published result.
Run the project's build, typecheck, and tests.
Distinguish local verification from live testing:
`prism components dev` commands can execute actions and create remote resources.
Publish or test against the platform when that is within the user's requested
scope. Publish the final verified build, rebuilding after any source changes.

Explain what the user can now do in the low-code designer, any setup still needed,
and what was actually tested. Include concrete designer setup for the relevant
connection, trigger, and action inputs.
