---
name: prismatic-components
description: Build and update Prismatic custom connectors (components), including connections, actions, and triggers for use in low-code integrations. Use when a user needs a connector for a service or changes to an existing component.
compatibility: Requires Node.js 22+, npm, the incur-based Prism CLI on PATH, and network access to documentation and packages. Publishing and platform tests also require Prismatic authentication.
---

# Prismatic components

A custom connector is a Spectral TypeScript component whose connections, actions,
and triggers appear in Prismatic's low-code designer.

Start from the user's request and the current project. Extend an existing
component when present; otherwise scaffold with `prism components init <name>`.
Use `prism --llms` and command `--help` or `--schema` to discover capabilities and
options, including OpenAPI generation. Prefer Prism's commands and generated
toolchain over custom scaffolding or publishing scripts.

Research the service's official documentation for the requested operations and
verify claims about unsupported capabilities against those sources.
Use [Prismatic's connector docs](https://prismatic.io/docs/custom-connectors/)
and [production components](https://github.com/prismatic-io/components/tree/main/components)
for SDK conventions and relevant examples. An existing connector can inform a
custom implementation without replacing the user's request.

Infer technical choices from the documentation and project. Ask only about
missing business requirements that change the result, in terms the user can
answer. Continue independent work while those details are unresolved.

Expose credentials through Spectral connections, and operations through labeled
inputs and outputs usable in the designer. Implement the requested trigger using
the service's supported event or polling mechanism, including setup and state
needed across executions. Check API behavior rather than inventing endpoints.

Run the project's build, typecheck, and relevant behavioral tests, including API
failure paths. Distinguish
local verification from live testing: `prism components dev` commands can execute
actions and create remote resources. Publish or test against the platform when
that is within the user's requested scope.

Explain what the user can now do in the low-code designer, any setup still needed,
and what was actually tested. Include concrete designer setup for the connection,
trigger, and action inputs.
