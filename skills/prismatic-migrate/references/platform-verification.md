# Platform verification

Use Prism's current `--help` or `--schema` and the
[official testing documentation](https://prismatic.io/docs/integrations/code-native/testing/)
to discover import, publication, configuration, flow execution, and log-query
operations. Select the intended organization/profile, integration, version, and
test instance from project evidence and the user's request before writing remotely.
Reuse that target through iterations so fixes do not create unrelated integrations.

Import the built CNI for runner testing. Import creates a test instance; publishing
a version and deploying an instance are distinct operations. Publish and deploy
when required by the requested verification, and ensure the instance under test
actually runs the intended version. Exercise configuration and connections as well
as representative flow payloads. Test environments can still send real messages,
write records, or register webhooks through lifecycle hooks; keep those effects
within the authorized accounts, resources, and test data.

Capture execution IDs and inspect terminal status, logs, outputs, and relevant
external effects. An accepted invocation or successful publish is not evidence
that the flow succeeded. Query logs for the specific execution; use targeted
`context.logger` diagnostics when needed without exposing secrets or sensitive
payloads. Check the business result, including managed-component behavior that
local mocks cannot establish.

Use failures to guide repairs: inspect the evidence, change the implementation or
configuration, rerun relevant local checks, update the platform target, and repeat
the affected flow and smoke tests. Before replaying work, determine which effects
already committed and whether replay is safe; use isolated test data or reconcile
prior effects when retries could duplicate them. Bound polling and retry attempts.
Stop when the requested checks pass, a missing dependency or authorization blocks
progress, or repeated attempts produce no new evidence; report the concrete blocker
and continue any independent work. Do not bypass a read-only or permission policy.

Record the tested integration/version/instance, execution IDs, observed results,
and remaining gaps. Distinguish local checks, runner tests, and deployed-instance
smoke tests. Account for resources created during verification and clean them up
within the agreed scope; do not remove the requested deliverable or unrelated data.
