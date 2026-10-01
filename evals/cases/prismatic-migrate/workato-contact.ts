import { resolve } from "node:path";
import { defineMigrationCase } from "./_migration-case.ts";

export default defineMigrationCase({
  id: "workato-contact",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/workato-contact/input",
  ),
  request:
    "We want to replace this Workato recipe with a callable Prismatic integration. Other integrations already call it to create or update Salesforce contacts, and we want to avoid changing those callers beyond the endpoint and connection setup. Build and verify a local port from the export. Show the caller contract and explain any differences or missing information that we must resolve before rollout.",
  persona:
    "You maintain integrations that call this recipe, not the Salesforce connector itself. Answer the question asked using the supplied recipe JSON; do not guess undocumented connector behavior. If asked about callers, they need the recipe result and the replacement must preserve the exported input and result contract. You have not approved trimming or otherwise normalizing stored names, clearing an omitted name, changing error results, or introducing a new matching policy. If asked about Salesforce configuration, no credentials or missing connection export are available this session, and you cannot confirm org-specific uniqueness, matching, or API permissions. Ask the agent to identify the evidence needed for any unresolved behavior and proceed with the supported local implementation. Target libraries and APIs are the agent's choice when supported; you do not choose them or approve unverified service contracts. Do not invent production traffic, duplicate-contact examples, or an external-ID field.",
  sourceContract:
    "The Workato recipe defines callable parameters email and last_name required, first_name optional. Salesforce upsert_sobject Contact uses query_field.primary_key Email. Its embedded schema describes matching by email and updating or creating; this is observable behavior, not a requirement to implement separate search and write calls. Salesforce Contact.Email has idLookup support in some APIs; validate the selected connector/API contract rather than declaring all native Email upserts invalid or treating a generic externalIdFieldName input as proof. Email and LastName map from parameters; FirstName uses present? then value else skip, which omits the field rather than clearing existing data when absent, empty, or whitespace-only (Workato string-formulas present?/blank? semantics). Success returns contact_id from action id and status success. Catch has max_retry_count string 0; logs the error with user_logs_enabled false and returns contact_id null and status 'error: ' plus caught message. Concurrency is 1. Salesforce connection config references an absent Salesforce/de_org.connection.json. The definition alone does not establish runtime atomicity or idempotence.",
  criteria: [
    {
      id: "callable-contact-behavior",
      criteria:
        "The CNI provides a callable entry with the recipe's input requirements and a supported invocation configuration that actually returns the success/error result object to the caller. Returning data from onExecution alone is insufficient if the documented invocation instead returns an asynchronous execution ID; synchronous flow configuration or a correctly documented synchronous invocation mechanism is acceptable. It creates or updates Contact by email using a supported Salesforce contract, maps names, and preserves FirstName omission for absent, empty, and whitespace-only input. A JavaScript truthiness check alone does not preserve whitespace omission. It returns contact_id/status success on success and null contact_id/status error message for caught failures. A real connector action does not by itself establish compatibility of the supplied matching field. Require evidence for the selected API/connector contract, not merely an action name or filename. Native upsert and search/create/update approaches can both pass when supported; do not require one architecture. Disclosure of an unverified match mechanism earns handoff credit, not implementation credit. Do not accept silently clearing FirstName. Multiple-match behavior or unavailable source connector details must be grounded in documentation or disclosed rather than guessed.",
    },
    {
      id: "failure-and-connection-contract",
      criteria:
        "The port exposes Salesforce credentials as deployment configuration, accounts for the absent connection export, and preserves the caught-error response rather than merely throwing away the callable result. It does not introduce undisclosed broad retries over non-atomic search/create behavior or claim stronger uniqueness/delivery guarantees than source evidence supports. Logging and source concurrency are considered, with relevant differences disclosed. Workato-specific log-service flags need not be copied literally.",
    },
  ],
  tests:
    "Exercise the generated implementation with no existing match and one existing match, present, absent, empty, and whitespace-only first_name (assert omitted update rather than null), required input failures, and a Salesforce failure returning the source-defined error result. Mock observable service requests/results rather than only a detached transformation. Verify contacts with quoted/special-character emails do not break whichever documented search mechanism is selected.",
  tags: ["workato", "callable", "omission-semantics"],
});
