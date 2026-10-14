import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/workato-contact/input",
  prompt: suite.prompt(
    "We want to replace this Workato recipe with a callable Prismatic integration. Other integrations already call it to create or update Salesforce contacts, and we want to avoid changing those callers beyond the endpoint and connection setup. Build and verify a local port from the export. Show the caller contract and explain any differences or missing information that we must resolve before rollout.",
  ),
  persona:
    "You maintain integrations that call this recipe, not the Salesforce connector itself. The supplied recipe JSON is the available contract. If asked about callers, they need the recipe result and the replacement must preserve the exported input and result contract. You have not approved trimming or otherwise normalizing stored names, clearing an omitted name, changing error results, or introducing a new matching policy. If asked about Salesforce configuration, no credentials or missing connection export are available this session, and you cannot confirm org-specific uniqueness, matching, or API permissions. Ask the agent to identify the evidence needed for any unresolved behavior and proceed with the supported local implementation. You cannot approve unverified service contracts.",
  assertions: [
    {
      type: "rubric",
      id: "callable-contact-behavior",
      criteria:
        "The CNI's callable entry requires email and last_name, accepts optional first_name, and actually returns the result object to the caller. Returning from onExecution alone is insufficient when invocation instead returns an asynchronous execution ID. It creates or updates Contact by email, mapping Email and LastName unchanged and omitting FirstName for absent, empty or whitespace-only input rather than clearing it. JavaScript truthiness alone misses whitespace omission. Native Email upsert and search/create/update are valid with evidence for the chosen connector/API: Contact.Email supports idLookup in some APIs, but a generic externalIdFieldName input or action name alone proves nothing. Do not infer undocumented multiple-match behavior. Preserve quoted and special-character email values safely through the selected search mechanism. Success returns {contact_id: action id, status: 'success'}; caught failure returns {contact_id: null, status: 'error: ' + caught message}.",
    },
    {
      type: "rubric",
      id: "failure-and-connection-contract",
      criteria:
        "Salesforce credentials are deployment configuration; the referenced Salesforce/de_org.connection.json is absent. Preserve the caught-error response and source's zero retries. Account for source concurrency 1 and logging with user_logs_enabled false, disclosing relevant differences without requiring literal Workato log flags. Do not introduce undisclosed retries around non-atomic search/create or claim uniqueness, atomicity or idempotence unsupported by the export. An unverified match mechanism can earn truthful-handoff credit, not implementation credit.",
    },
  ],
});
