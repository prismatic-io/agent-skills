import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineMigrationCase } from "../../migration-case.ts";

const packet = resolve(
  import.meta.dirname,
  "../../fixtures/migrations/paragon-create-contact",
);
const read = (name: string) => readFile(resolve(packet, name), "utf8");

export default defineMigrationCase({
  id: "paragon-create-contact",
  fixture: resolve(packet, "input"),
  request: await read("REQUEST.txt"),
  persona: await read("PERSONA.md"),
  sourceContract:
    "These are exported declarations, not executed runtime observations. EndpointStep disallows arbitrary payload and declares required STRING body keys first_name, last_name, email, title; exact rejection envelope and extra-key handling remain unknown. Contact search uses StringExactlyMatches('Email', body.email), then ArrayIsEmpty(result.records). Empty results create Contact; nonempty results take the duplicate response without creation. Creation string-interpolates first_name/last_name/email/title into field-FirstName/field-LastName/field-Email/field-Title; field-accountId and field-Description are literal empty strings, with generated SDK serialization unresolved. Creation completion leads to HTTP200 JSON {status:'200'}; duplicates lead to HTTP200 JSON {status:'400',error:'Duplicate Contact Found'}. Both actions declare autoRetry:false and continueWorkflowOnError:false; exact platform failure envelopes are unknown. Optional field_mapping labels first name/last name are declared but unused in define. defaultEnabled:false, hidden:false and permissions undefined are metadata, not proof of deployed visibility/authentication. No explicit authenticatedUser property is declared on this endpoint. Generated @useparagon/integrations/salesforce is absent and undeclared in package.json, para build environment is not established, and config imports missing unrelated workflows. No actual search translation/collation, empty-field API treatment, account routing, hosted response delivery, atomic uniqueness, pagination or retry execution has been established. Preserve supported behavior and precisely disclose unsupported runtime assumptions; absent generated source does not require a fake SDK or block the entire local port.",
  criteria: [
    {
      id: "input-search-and-branch",
      criteria:
        "The registered replacement enforces the declared required-string boundary before Salesforce work and searches Contact by the supplied email with evidence-grounded equality semantics. It creates on empty results and takes the duplicate path for any nonempty result without creating. Do not invent a source error envelope, extra-key policy, email normalization/collation or deployed authentication. Safe expression construction should preserve special-character values rather than changing the intended search. Equivalent supported target architectures and connector/client choices are valid.",
    },
    {
      id: "contact-write-and-caller-response",
      criteria:
        "Creation preserves the four declared field values and meaning of the literal empty accountId/Description declarations, or precisely documents an evidence-supported compatibility decision where absent SDK serialization prevents exact parity. Do not require invented SDK behavior or silently substitute a different account/description policy. The completed caller path distinguishes HTTP200 with string status '200' after creation from HTTP200 with string status '400' and error 'Duplicate Contact Found' on duplicates. A detached helper return, renamed status field, queued execution identifier or actual HTTP400 alone does not establish that caller contract. Account/hosted-runtime dependencies may remain explicit; no particular response adapter architecture is mandatory.",
    },
    {
      id: "failure-and-bounded-scope",
      criteria:
        "Failed searches stop before creation or an ordinary duplicate-success response; failed creation cannot report creation success. Preserve declared no-step-retry and stop-on-error intent or clearly disclose a proposed change, grounding failure handling in the selected target operation's documented contract. Do not claim atomic duplicate prevention or exactly-once creation from search-then-create. Keep unrelated Salesforce/sync and Slack workflows outside scope; unused field_mapping must not be presented as the source of creation mapping. Explain relevant metadata disposition without forcing identical destination metadata.",
    },
  ],
  tests:
    "Exercise the delivered registered input/search/branch/create/caller path with representative valid values, zero and nonzero search results, invalid required inputs, special-character email, and consequential search/create failures. Observe requests, creation suppression and both HTTP/body status combinations independently of implementation assumptions. Equivalent cases and techniques are valid; no fixed inventory, fake generated SDK, live credentials or source runtime execution is required. Controlled doubles establish local behavior only; disclose unresolved connector serialization and hosted caller delivery rather than inventing parity.",
  tags: ["paragon", "salesforce", "prospective-transfer"],
});
