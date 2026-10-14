import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as suite from "./_suite.ts";

const packet = resolve(
  import.meta.dirname,
  "../../fixtures/migrations/paragon-send-slack-message",
);
const read = (name: string) => readFile(resolve(packet, name), "utf8");

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/paragon-send-slack-message/input",
  prompt: suite.prompt(await read("REQUEST.txt")),
  persona: await read("PERSONA.md"),
  assertions: [
    {
      type: "rubric",
      id: "message-sender-and-caller",
      criteria:
        "Deliver a useful locally callable send operation preserving the declared message value, connected person's sender intent, and caller JSON property status whose value is selected from the completed send's ok. Distinguish that literal body property from the HTTP status code: silently returning an ok property instead changes the caller contract. Cite the source response expression and the delivered registered result/caller adapter and effective JSON, rather than accepting comments or helper-only returns as proof. A helper return or queued execution ID alone does not establish that caller result. An explicit proposed caller change can be useful if its effect is clear; do not silently replace the connected person with a shared bot. Account-specific setup may remain a precisely identified dependency. Respect the test-only channel and keep Salesforce/sync work outside scope. Source sends to tutorial channel parato-testing-ground with authenticatedUser:true, empty botName and placeholder botIcon; the integration channel input is unused. ResponseStep HTTP200 returns {status: actionStep.output.result.ok}. A configurable or resolved target channel is valid when explained; the tutorial literal does not authorize a real send.",
    },
    {
      type: "rubric",
      id: "validation-and-failure",
      criteria:
        "Implement the declared required-string input boundary before sending and handle failure of the selected target send operation without taking an ordinary apparent-success path. Ground result envelopes and failure forms in that operation's actual contract. Preserve the explicit no-step-retry/stop-on-error intention or explain a proposed change. Do not invent Paragon wrapper behavior or guarantee no message was accepted after an ambiguous transport failure. No exact hosted source error envelope is required. EndpointStep requires STRING message and sets allowArbitraryPayload:false with no header/query validations. Empty-string/extra-key details and hidden wrapper result/failure envelopes remain unknown. The action declares autoRetry:false and continueWorkflowOnError:false; no mandatory target timeout follows from current Paragon docs.",
    },
    {
      ...suite.handoff,
      criteria:
        "Explain the useful local result, actual verification, proposed caller/configuration changes and concrete account/deployment decisions still needed. Distinguish workflow declarations from absent generated integration code, source account settings and unverified hosted behavior. Explain how the connected-person sender will be established or what evidence remains necessary. Do not claim live compatibility, activation or successful sending from mocks, or demand recovery of unrelated out-of-scope workflows before delivering the bounded part. @useparagon/core 1.1.16 uses para build, but imported @useparagon/integrations/slack and three workflow imports are absent. No .para metadata, OAuth configuration, connected-user records or caller is supplied. Source defaultEnabled:false does not establish current enablement; target scope/auth and activation require an operator decision.",
    },
  ],
});
