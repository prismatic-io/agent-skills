# Azure Logic Apps source semantics

Use when interpreting Logic Apps definitions or projects. These are source-runtime
semantics to investigate where relevant, not a prescribed Prismatic architecture.
Identify Consumption versus Standard, workflow kind, connector implementation and
explicit settings before applying a default.

## What the export establishes

A Consumption ARM resource can wrap the executable definition in
`properties.definition`. Distinguish ARM deployment parameters from workflow
runtime parameters; `$connections` references connection resources rather than
embedding a portable authenticated session. A template can describe an integration
without supplying its deployed values or authorization. Follow referenced
connections, child workflows and external artifacts that affect behavior.
[ARM template structure](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-azure-resource-manager-templates-overview)
and [parameter evaluation](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-author-definitions#parameters).

Standard projects can contain multiple workflow folders with `workflow.json`, plus
shared `connections.json`, `host.json` and app settings. A single workflow file
therefore need not capture connection configuration or effective runtime limits.
`local.settings.json` describes local settings, not proof of deployed values.
[Standard project files](https://learn.microsoft.com/en-us/azure/logic-apps/create-standard-workflows-visual-studio-code).

Read action types, inputs, expressions, nested actions and dependencies rather
than inferring behavior from display names. Trigger `splitOn`, pagination,
concurrency and loop settings can change invocation cardinality and ordering.
[Trigger/action schema](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-workflow-actions-triggers).

## Status and failure boundaries

`runAfter` names predecessor actions and acceptable terminal statuses. With several
predecessors, each must meet its permitted status condition. `Succeeded`, `Failed`,
`Skipped` and `TimedOut` are distinct; a failure-only branch is not automatically a
timeout handler. A later action failing does not retroactively change its
predecessor's status. Combining independent branches into one broad exception
handler can therefore change which external effects occur. Overall run status
also depends on branch outcomes; catching one error does not establish it.
[Run-after and error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling#manage-the-run-after-behavior).

Scopes aggregate grouped actions' status. Preserve the relevant group's boundary
when interpreting downstream conditions, including nested scopes and parallel
branches; a scope is not a database transaction or automatic compensation.
[Scope behavior](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-control-flow-run-steps-group-scopes).

## HTTP defaults are executable behavior

For operations that support retry policies, absent `inputs.retryPolicy` means the
operation's default policy, not zero retries. HTTP retry handling includes timeouts
and 408/429/5xx responses. Many operations use up to four exponential retries, but
connector exceptions and Consumption/Standard settings exist; confirm the relevant
operation and runtime before reproducing counts or timing. An immediate failure
from a single fetch can change downstream failure routing.
[Retry policies](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling#retry-policies).

HTTP and APIConnection actions can also implicitly follow the asynchronous
operation pattern: a 202 response with a Location URL can lead to polling for
completion. Inspect `operationOptions`, including `DisableAsyncPattern`, rather
than treating every successful HTTP status as completed business work.
[Operation options](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-workflow-actions-triggers#operation-options).

This asynchronous default applies to supporting stateful workflows. Standard
stateless workflows do not poll Location after 202; they continue execution.
Stateful workflows persist execution state and can recover interrupted runs;
stateless execution is in memory and does not provide equivalent recovery.
Long waits, callbacks and pending runs therefore need an explicit continuation or
transition decision when replacing their runtime. A timer in one process does not
by itself reproduce durable waiting. Determine actual configured limits rather
than assuming all Logic Apps executions have the same lifetime.
[Stateful/stateless differences](https://learn.microsoft.com/en-us/azure/logic-apps/single-tenant-overview-compare#stateful-and-stateless-workflows).

## Connector operations and external effects

Managed connectors and Standard built-in service-provider connectors have different
hosts and contracts. Resolve the actual operation/version and its reference:
outputs may be content, metadata or a batch; polling, webhook registration and
pagination behavior are operation-specific. A similarly named target action is
not evidence of equivalence.
[Connector models](https://learn.microsoft.com/en-us/azure/connectors/introduction).

For message services, distinguish receive-and-delete from peek-lock, and processing
from completion, abandonment, lock renewal or dead-lettering. Settlement can fail
after downstream work succeeds; redelivery and lock loss need separate reasoning
from business-work failure. Preserve the exported control dependencies without
silently treating every later exception as permission to discard a message.
[Service Bus operations](https://learn.microsoft.com/en-us/connectors/servicebus/)
and [locks and settlement](https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-transfers-locks-settlement).

## Content representation

Logic Apps handles JSON and plain text natively and can represent other content
using `$content` (base64) with `$content-type` metadata. Runtime pass-through can
restore bytes and content type automatically. When moving that behavior into
code, distinguish an envelope, decoded bytes and an ordinary string; serializing
the envelope or decoding arbitrary bytes as UTF-8 can alter the payload. Explicit
`json()`, `string()`, `binary()` and base64 conversions are meaningful operations,
not interchangeable wrappers. HTTP success alone does not require a JSON body.
[Content types and conversions](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-content-type).
