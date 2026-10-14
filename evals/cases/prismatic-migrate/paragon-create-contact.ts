import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as suite from "./_suite.ts";

const packet = resolve(
  import.meta.dirname,
  "../../fixtures/migrations/paragon-create-contact",
);
const read = (name: string) => readFile(resolve(packet, name), "utf8");

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/paragon-create-contact/input",
  prompt: suite.prompt(await read("REQUEST.txt")),
  persona: await read("PERSONA.md"),
  assertions: [
    {
      type: "rubric",
      id: "input-search-and-branch",
      criteria:
        "The registered replacement enforces the declared required-string boundary before Salesforce work and searches Contact by the supplied email with evidence-grounded equality semantics. It creates on empty results and takes the duplicate path for any nonempty result without creating. Do not invent a source error envelope, extra-key policy, email normalization/collation or deployed authentication. Safe expression construction should preserve special-character values rather than changing the intended search. Equivalent supported target architectures and connector/client choices are valid. Required STRING fields are first_name, last_name, email and title. Source EndpointStep has allowArbitraryPayload:false; StringExactlyMatches(Email, body.email) feeds ArrayIsEmpty(result.records). Exact hosted rejection/extra-key semantics remain unknown.",
    },
    {
      type: "rubric",
      id: "contact-write-and-caller-response",
      criteria:
        "Creation preserves the four declared field values and meaning of the literal empty accountId/Description declarations, or precisely documents an evidence-supported compatibility decision where absent SDK serialization prevents exact parity. Do not require invented SDK behavior or silently substitute a different account/description policy. The completed caller path distinguishes HTTP200 with string status '200' after creation from HTTP200 with string status '400' and error 'Duplicate Contact Found' on duplicates. A detached helper return, renamed status field, queued execution identifier or actual HTTP400 alone does not establish that caller contract. Account/hosted-runtime dependencies may remain explicit; no particular response adapter architecture is mandatory. Source string-interpolates those inputs into field-FirstName, field-LastName, field-Email and field-Title; field-accountId and field-Description are literal empty strings whose generated SDK serialization is unavailable.",
    },
    {
      type: "rubric",
      id: "failure-and-bounded-scope",
      criteria:
        "Failed searches stop before creation or an ordinary duplicate-success response; failed creation cannot report creation success. Preserve declared no-step-retry and stop-on-error intent or clearly disclose a proposed change, grounding failure handling in the selected target operation's documented contract. Do not claim atomic duplicate prevention or exactly-once creation from search-then-create. Keep unrelated Salesforce/sync and Slack workflows outside scope; unused field_mapping must not be presented as the source of creation mapping. Explain relevant metadata disposition without forcing identical destination metadata. Both actions set autoRetry:false and continueWorkflowOnError:false. defaultEnabled:false, hidden:false and undefined permissions are metadata, not deployed auth evidence; no authenticatedUser is declared. @useparagon/integrations/salesforce is absent and undeclared, para build is unestablished, and config references unrelated missing workflows. Search collation, account routing, pagination and hosted envelopes are not established by declarations.",
    },
  ],
});
