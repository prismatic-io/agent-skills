import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineMigrationCase } from "./_migration-case.ts";

const packet = resolve(
  import.meta.dirname,
  "../../fixtures/migrations/paragon-send-slack-message",
);
const read = (name: string) => readFile(resolve(packet, name), "utf8");
const expectations = await read("EXPECTATIONS.md");
// Keep source declarations and uncertainty in the shared rubric budget; the
// detailed probe examples remain in EXPECTATIONS.md for independent review.
const supported = expectations.indexOf("## Supported behavior");
const paragraph = expectations.indexOf("\n\n", supported) + 2;
const contract = [
  expectations.slice(paragraph, expectations.indexOf("\n\n", paragraph)),
  expectations.slice(
    expectations.indexOf("## Known unknowns"),
    expectations.indexOf("## Primary documentation"),
  ),
].join("\n\n");

export default defineMigrationCase({
  id: "paragon-send-slack-message",
  fixture: resolve(packet, "input"),
  request: await read("REQUEST.txt"),
  persona: await read("PERSONA.md"),
  sourceContract: `${contract}\n\nInterpretation boundaries: Never infer hidden Paragon SDK, target connector envelope, empty-string validation semantics, extra-key policy, exactly-once sending or mandatory target timeout. Source AST checks, helper-only tests and claims are not runtime evidence. Missing credentials/generated source may leave precise account/live-runtime blockers, but do not justify silent-success stubs for known behavior.`,
  criteria: [
    {
      id: "message-sender-and-caller",
      criteria:
        "Deliver a useful locally callable send operation preserving the declared message value, connected person's sender intent, and caller JSON property status whose value is selected from the completed send's ok. Distinguish that literal body property from the HTTP status code: silently returning an ok property instead changes the caller contract. Cite the source response expression and the delivered registered result/caller adapter and effective JSON, rather than accepting comments or helper-only returns as proof. A helper return or queued execution ID alone does not establish that caller result. An explicit proposed caller change can be useful if its effect is clear; do not silently replace the connected person with a shared bot. Account-specific setup may remain a precisely identified dependency. Respect the test-only channel and keep Salesforce/sync work outside scope.",
    },
    {
      id: "validation-and-failure",
      criteria:
        "Implement the declared required-string input boundary before sending and handle failure of the selected target send operation without taking an ordinary apparent-success path. Ground result envelopes and failure forms in that operation's actual contract. Preserve the explicit no-step-retry/stop-on-error intention or explain a proposed change. Do not invent Paragon wrapper behavior or guarantee no message was accepted after an ambiguous transport failure. No exact hosted source error envelope is required.",
    },
  ],
  tests:
    "Provide meaningful local verification of the delivered registered caller/send/result path and a consequential failure, using the chosen target interface faithfully. Include evidence that message values and sender/account routing are not silently changed. Accept equivalent scenarios and techniques; no fixed test inventory or live credentials are required. Source declaration checks establish source facts only. Missing coverage is a verification gap, not proof correct implementation is absent.",
  handoff:
    "Explain the useful local result, actual verification, proposed caller/configuration changes and concrete account/deployment decisions still needed. Distinguish workflow declarations from absent generated integration code, source account settings and unverified hosted behavior. Explain how the connected-person sender will be established or what evidence remains necessary. Do not claim live compatibility, activation or successful sending from mocks, or demand recovery of unrelated out-of-scope workflows before delivering the bounded part.",
  tags: ["paragon", "supplemental-feasibility"],
});
