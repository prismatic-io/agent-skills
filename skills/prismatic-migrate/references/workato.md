# Workato source semantics

Use this when interpreting Workato recipes, packages, or caller behavior. These are documentation-backed discovery clues, not a conversion schema or a required target architecture.

## What the source contains

Recipe Lifecycle Management packages contain selected recipes and dependencies. Selection matters: cross-project dependencies are not automatically included, dependencies can be deselected, and lookup-table exports default to headers without rows. A recipe can therefore be intact while its business rules or called functions are missing. Connection exports contain names and non-sensitive configuration, not usable credentials. [Package export](https://docs.workato.com/recipe-development-lifecycle/export.html), [connection import behavior](https://docs.workato.com/recipe-development-lifecycle/import.html).

An API recipe object is not necessarily the same envelope as a package file. `GET /api/recipes/:id` returns `code` as a JSON string describing steps and separate connection `config`; decode according to the actual input rather than assuming every nested value is already an object. Follow step references, nested control blocks, formula strings, and embedded schemas in the supplied version. The API documentation does not establish a universal connector-independent export schema. [Recipes API](https://docs.workato.com/en/workato-api/recipes).

## Values and external operations

Directly mapping a field from a list datapill uses the first item. Inside Repeat, the original list reference still selects that first item; the Repeat datatree supplies the current item. Repeat's **Clear step output** defaults to **No**, so a conditional step skipped on a later iteration can leave its earlier output available. Fresh loop-local values can therefore change the recipe's behavior. [List references and retained outputs](https://docs.workato.com/en/features/list-management), [Repeat for each](https://docs.workato.com/en/recipes/repeat-for-each).

For Ruby-style recipe formulas, `present?`/`blank?` treat missing, empty, and whitespace-only strings as blank. A presence test does not itself trim a nonblank string. `skip` omits a destination field, retaining an existing value; `clear` explicitly clears it. Replacing omission with null, or adding normalization, can change writes. Interpret the formula language actually used; newer Workato Expression Language documentation is separate from Ruby-style formulas. [String formulas](https://docs.workato.com/en/formulas/string-formulas), [skip, clear, and null](https://docs.workato.com/en/formulas/other-formulas).

Connector action names are insufficient evidence of matching or write semantics. Establish matching cardinality, key eligibility, and the underlying API/version before choosing a replacement. For example, Workato's Salesforce upsert errors when multiple records match the primary key; a search followed by an arbitrary first-match update changes that behavior. An input label alone does not establish which destination fields are eligible keys. [Salesforce upsert](https://docs.workato.com/en/connectors/salesforce/actions/upsert-record). Salesforce SOAP upsert permits standard-object fields with `idLookup`, as well as custom external-ID fields. Check field metadata and the selected API/connector before ruling native upsert in or out. [Destination upsert contract](https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-upsert.html).

## Calls, errors, and ordering

Recipe functions have distinct synchronous, asynchronous, return, and wait-for-async actions. A synchronous call waits for its result; an asynchronous call does not return result data directly. Returning data terminates the function job, ignoring later steps. Preserve the actual caller/result boundary, including error results deliberately returned as data; a callable function is not automatically an HTTP API. [Recipe functions](https://docs.workato.com/connectors/recipe-functions.html), [return action](https://docs.workato.com/en/connectors/recipe-functions/actions/return-data-from-a-recipe-function).

Handle errors has monitored and error-handling blocks. Its default is no retry; configured retries occur before the remaining error-handling steps. This setting alone does not establish connector-internal retry behavior. API-request timeout can terminate an API recipe without running its On error block. [Error handling](https://docs.workato.com/recipes/best-practices-error-handling).

Recipe concurrency settings are behavior, but concurrency one is not universal serialization: a long action placed on hold can release the next job. Synchronous function calls also have documented out-of-order exceptions. Those exceptions must apply to the actual actions before they explain source behavior; they do not establish that an arbitrary replacement race already existed. [Trigger ordering](https://docs.workato.com/en/recipes/triggers), [synchronous function limitations](https://docs.workato.com/connectors/recipe-functions/actions/call-recipe-function-synchronously.html).

## Runtime evidence and handoff

Trigger progress survives ordinary stop/start for polling recipes; webhook behavior differs. Testing can consume trigger events that will not be processed again on start. Definitions alone do not establish the current cursor, pending jobs, or safe replay boundary. [Starting and stopping](https://docs.workato.com/en/recipes/start-and-stop.html), [trigger semantics](https://docs.workato.com/en/recipes/triggers).

Connection ownership can vary at runtime: recipe functions can use either runtime user connections or default recipe connections. Resolve the actual caller/customer scope before replacing a shared connection or exposing a callable recipe externally. [Runtime user connections](https://docs.workato.com/features/runtime-user-connections/using-runtime-user-connections-in-recipe-functions).
