---
name: prismatic-components
description: Build and update Prismatic custom connectors (components), including connections, actions, and triggers for use in low-code integrations. Use when a user needs a connector for a service or changes to an existing component.
compatibility: Requires Node.js 22+, npm, Prism CLI 11 or later on PATH, and network access to documentation and packages. Publishing and platform tests also require Prismatic authentication.
---

# Prismatic components

A custom connector is a Spectral TypeScript component whose connections, actions,
and triggers appear in Prismatic's low-code designer.

Start from the user's request and the current project. Before implementing the
change, record concrete acceptance cases: inputs, relevant prior state, and expected
outcomes derived from the user workflow and authoritative contract. Use these
expectations in tests or registered-metadata checks; do not derive expected results
from the implementation. Extend an existing component when present, preserving
existing keys and behavior outside the requested change; otherwise scaffold with
`prism components init <name>`.
Use `prism --llms` and command `--help` or `--schema` to discover capabilities and
options, including OpenAPI generation. Prefer Prism's commands and generated
toolchain over custom scaffolding or publishing scripts.
Treat generated code as a starting point: keep actions that serve the requested
workflow, remove unrelated generated actions and unused supporting code, and
shape labels, inputs, and outputs around the builder's task. Do not retain the
whole API merely because it was generated. When editing, preserve existing
integration contracts unless the user requests their removal.

Use the supplied specification for the requested API version as the service
contract, filling gaps from official documentation. When a supported official SDK
already implements a multi-step service protocol, prefer its operation over
reimplementing that protocol, unless it cannot meet the requested behavior or
project constraints. Verify the relevant SDK version and keep its request-building
under test. Check generated authentication
and parameter serialization against it; defaults and other connectors' examples
may target a different API. Verify claims about unsupported capabilities against
official sources.
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
For trigger work, read [Trigger contracts](references/triggers.md). Lifecycle
callbacks differ from normal executions; SDK types alone may not express which
state is available at runtime.

For a requested designer interaction, verify the registered structure and behavior
that provides it; descriptive labels or the outgoing API shape do not establish
that interaction.
Before publication or handoff, check each acceptance case against an actual test or
inspection result. For the requested behavior, challenge passing tests against the contract: if a plausible
wrong behavior would still pass, tighten the relevant fixture or assertion and
rerun it. Choose boundary cases that
distinguish correct behavior from a plausible mistake:

- Check the registered metadata and relationships that make the requested
  connections, inputs, actions, and triggers usable in the designer, including
  required/optional inputs and data-source references. For optional inputs relevant
  to the requested behavior, exercise registered SDK defaults as well as supplied
  values; explicitly passing `undefined` may not represent an unset designer input.
  Use Prism's
  member-inspection commands (`--help` or `--schema`) to verify published configuration.
- For behavior tests, prefer Spectral `testing.createHarness(component)` and its
  action or trigger entrypoint so registered input cleaning, defaults, and callback
  wrappers remain active. Mock transport or the remote service, keeping request
  construction under test. For callbacks the helper does not expose, preserve the
  SDK/runtime context and persistence contracts. Check outgoing requests, returned
  data, a relevant API failure, and contract-derived boundary values, including
  URL-reserved characters in identifier tests where the contract permits them. For JSON
  inputs that permit arbitrary values, test nested non-string values. For binary
  file transfers, compare exact bytes (for example, `Buffer.from([0x00, 0xff, 0x80])`).
- For stateful behavior, verify which state is available, its scope and ownership,
  and how changes persist against the SDK's actual contracts. Test repeated calls
  and recovery after failure in fresh invocations, including initialization when
  it differs from normal operation. When storage is shared, verify that independent
  owners remain separate. Mocks must not invent state unavailable to the callback.

For edits, rerun existing tests and verify the requested change while preserving
unaffected behavior.
Run the project's build, typecheck, and tests on the final source; resolve failures
before publication or handoff.
Distinguish local verification from live testing:
`prism components dev` commands can execute actions and create remote resources.
Publish or test against the platform when that is within the user's requested
scope. Publish the final verified build, rebuilding after any source changes.

Explain what the user can now do in the low-code designer, any setup still needed,
and what was actually tested. Name credentials still needed and the relevant
connection, trigger, and action setup; distinguish new setup from configuration
the user can keep.
