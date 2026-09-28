# Trigger contracts

Check the service contract and [Prismatic trigger documentation](https://prismatic.io/docs/custom-connectors/triggers/)
for the chosen mechanism and callback. Similar TypeScript context types do not
imply identical runtime behavior.

## Lifecycle state

During normal execution, `instanceState` is flow-scoped. Webhook lifecycle
callbacks do not have access to that flow-specific persisted state. Use their
documented shared `crossFlowState`, separating each flow's resources by stable
identity (`context.flow.stableId`) so renaming or versioning does not orphan them.
Do not replace a callback's context with a narrower invented type that hides this
distinction.

Follow the [documented persistence semantics](https://prismatic.io/docs/integrations/persist-data/)
for returned state or context mutation. In returned state updates, use `null` to
remove a persisted key; `undefined` is omitted during JSON serialization. Direct
context mutation is also supported. Verify persistence in a fresh invocation,
repeated setup and cleanup, independent owners sharing storage, and failure recovery. After an injected failure, restore persisted state into a
fresh invocation, let the service succeed, and verify pending work completes and
progress advances. Mocks must model the actual callback's state availability and
commit behavior.

## Event meaning and delivery

Receiving or authenticating an event does not establish that it matches the
user's requested business change. Configure documented upstream filtering or
check the payload, and verify both matching and nonmatching events. Derive any
signature verification from the service's documented payload format and protocol;
do not assume a familiar signing algorithm. When verification depends on configuration or persisted
state, test missing or unusable values as well as invalid signatures; missing
values must not silently disable configured verification.

For polling, follow documented pagination and retention limits. Preserve the
logical result set across a traversal, following the service's continuation rules;
do not advance a filter while retaining an offset into the previous result set.
In tests, assert or model how request filters, ordering, and continuation select
each response page. Checkpoints must not skip unprocessed changes. Batch pagination re-invokes the trigger for each page.
Preserve initialization and recovery semantics across successful page invocations
and fresh retries; a pagination cursor alone may not survive a restarted poll.
Test multiple pages and repeated polls, including recovery during initial baseline
establishment when its semantics differ. When polling establishes a baseline,
verify that a successfully completed empty baseline initializes polling, distinct
from a failed attempt, and that subsequent eligible changes are delivered. If the workflow
includes both new and changed entities, test creation separately from a later
change to an existing entity using the service's identity contract. Explain service
limits that affect the requested workflow.
