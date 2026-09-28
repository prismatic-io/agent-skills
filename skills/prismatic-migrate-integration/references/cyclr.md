# Cyclr source semantics

Use when interpreting Cyclr Template Releases, account Cycles, connector definitions, or partial API JSON. Export coverage and connector contracts depend on the export type and release; a sparse graph can support useful partial work without establishing a complete runtime contract.

## Determine what the JSON actually contains

Identify the export mechanism from the supplied structure or accompanying evidence before applying its coverage guarantees. A Template Release export includes the connector releases used by that template. Account Cycle export/import separately documents limitations for Account Connector Properties, webhook key mappings, and Cycle Linking Steps. These statements do not establish that a Template Release recovers all account state, or that every sparse JSON file came from account export. Missing data remains unresolved until the applicable export contract or source evidence explains it. [Template Release exports](https://community.cyclr.com/user-documentation/cyclr-console/github-integration), [Cycle exports](https://community.cyclr.com/user-documentation/accounts/export-or-import-cycles)

Separate the connector definition, its methods, and its installation into an account. Installation selects a connector and authentication configuration and can supply account-specific properties. A workflow step's connector or method ID is therefore a reference to resolve, not an HTTP contract by itself. Consult the corresponding release's method definition for endpoint, verb, parameters, request/response fields, and scripting before selecting a replacement operation. [Connector installation](https://community.cyclr.com/user-documentation/api/install-connectors), [Method definitions](https://community.cyclr.com/user-documentation/custom-connectors/methods)

## Reconstruct transactions and graph behavior

Collection splitting changes transaction boundaries: each split item travels as its own transaction. Cycle settings can split at the trigger, all steps, or nowhere; a step override takes precedence. Splitting relies on the method's declared response fields, so seeing an array in sample JSON does not establish iteration behavior. Validate cardinality and failure scope against the effective setting and method schema. [Collection splitting](https://community.cyclr.com/user-documentation/templates/collection-splitting)

Follow links and mappings as behavior, including inline scripts. Link To/From can chain or branch across templates/cycles, and the receiving release/schema matters. A partial graph with an unresolved linked cycle cannot establish the downstream effects. Event Trigger Webhook and Synchronous Response are distinct capabilities; a step label alone cannot establish when the caller receives a response. Inspect actual trigger and response configuration. [Connectivity tools](https://community.cyclr.com/user-documentation/templates/connectivity-tools)

## Authentication and uncertainty

Connector authentication governs calls to an external API; incoming webhook protection is a separate contract. The authentication guide describes named types, but does not establish numeric authentication-type or OAuth-subtype mappings for arbitrary exported JSON. Leave an unexplained number unresolved until a matching schema, connector release, or account configuration establishes its meaning. Even the named `None` type means no standard authentication flow: custom scripts and account parameters can still implement authentication. [Connector authentication](https://community.cyclr.com/user-documentation/custom-connectors/custom-connector-authentication), [Webhook security](https://community.cyclr.com/user-documentation/accounts/securing-cyclr-webhooks)

Resolve consequential gaps through the relevant method definition, account property, linked release, trigger setting, or observed transaction.
