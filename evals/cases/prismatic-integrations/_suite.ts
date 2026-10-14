import { resolve } from "node:path";
import { subjectPath } from "@prismatic-io/lux";
import { defineCase as baseCase } from "../_suite.ts";

export const defineCase = baseCase.extend({
  defaults: {
    assertions: [
      {
        id: "meaningful-tests",
        type: "rubric",
        informational: true,
        criteria:
          "Assess meaningful authored tests of the requested behavior and service contracts, including material failure and recovery risks. Existing baseline tests alone do not prove changed behavior. Local mocks are sufficient. For platform-owned behavior, inspect registered configuration and public contracts rather than requiring a local platform emulator.",
      },
      {
        id: "local-checks",
        type: "command-exits-zero",
        requiresExecutionWorkspace: true,
        timeout: "10 minutes",
        command: [
          process.execPath,
          resolve(import.meta.dirname, "../_verify-cni.mjs"),
        ],
      },
      {
        id: "handoff",
        type: "rubric",
        criteria:
          "Assess communication and interaction: material business ambiguities resolved through available context, reasonable disclosed assumptions, or questions when necessary; deployer configuration and credentials explained; useful handoff describing changes, material assumptions and actual verification. Asking questions is not itself required. Technical implementation choices should be researched rather than delegated to a nontechnical requester. A sufficient final message is valid; no separate documentation file, tutorial, exhaustive edge-case catalog, or repetition of unchanged setup is required. Do not deduct again for implementation or test gaps already graded elsewhere unless the handoff independently misrepresents them.",
        evidence: {
          view: "execution",
        },
      },
      {
        id: "platform-publication",
        type: "rubric",
        criteria:
          "Assess actual publication using executed Prism invocations and their results: a fresh CNI component is published, its integration is imported, and the returned integration identity is verified against the requested artifact. A successful CNI import reporting integration and generated component identities establishes bundled component publication; do not require a separate publish command. Interpret follow-up lookup failures against the command's selector contract before treating them as publication failures. Final-message claims or commands written into files alone do not establish publication. Preserve unrelated platform resources and external-service accounts; do not embed real secrets. Distinguish confirmed platform failures from unattempted publication and disclosed blockers.",
        evidence: {
          view: "execution",
        },
      },
    ],
  },
});

export const prompt = (request: string) =>
  `${request}\n\nUse the skill at ${subjectPath("prismatic-integrations/SKILL.md")}. Implement the requested Code Native Integration here, preserving existing customer configuration and unrelated behavior. Publish its component and import a new review copy of the integration into our Prismatic organization. Check that the review copy is available and leave it for us to inspect without overwriting existing components or integrations. External-service credentials are unavailable. Test external services with mocks; do not deploy customer instances or change connected services.`;
