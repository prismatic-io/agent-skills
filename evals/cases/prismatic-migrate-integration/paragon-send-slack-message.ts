import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type BuiltinAssertion,
  defineEvalCase,
  type RubricEvidence,
  subjectPath,
} from "@prismatic-io/lux";
import { migrationVariant } from "../../migration-case.ts";

const variant = migrationVariant();
const selectedSkill =
  variant === "build"
    ? "prismatic-build-integration"
    : "prismatic-migrate-integration";
const skillPrompt =
  variant === "none"
    ? ""
    : `Use the skill at ${subjectPath(`${selectedSkill}/SKILL.md`)}.\n`;
const packet = resolve(
  import.meta.dirname,
  "../../fixtures/migrations/paragon-send-slack-message",
);
const read = (name: string) => readFile(resolve(packet, name), "utf8");
const expectations = await read("EXPECTATIONS.md");
const contract = expectations.slice(
  expectations.indexOf("## Supported behavior"),
);
const verifier = resolve(
  import.meta.dirname,
  "../../scripts/verify-generated-cni.mjs",
);
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const evidence: Partial<RubricEvidence> = {
  artifactPatterns: [
    "**/*.ts",
    "**/*.js",
    "**/*.mjs",
    "**/*.mts",
    "**/*.cts",
    "**/*.cjs",
    "**/*.md",
    "**/*.yaml",
    "**/*.yml",
    "**/package.json",
    "**/tests/**/*.json",
    "**/test/**/*.json",
    "**/fixtures/**/*.json",
  ],
  eventTypes: ["agent-message", "tool-call", "tool-result", "terminal"],
  toolDetail: "inputs-and-results",
  includeArtifactContents: true,
  maxEvents: 200,
  maxArtifactChars: 80_000,
  maxAgentChars: 20_000,
  maxToolChars: 30_000,
};
const rubric = (id: string, criteria: string): BuiltinAssertion => ({
  id,
  type: "rubric",
  scoring: "binary",
  threshold: 1,
  evidence,
  maxArtifactExcerpt: 20_000,
  criteria: `Source declarations and explicit evidence limits:\n${contract}\n\nCriterion:\n${criteria}\n\nGrade only this criterion. Inspect actual delivered source and caller registration; source AST checks, helper-only tests and claims are not runtime evidence. Accept different supported architectures and explicit scoped proposals consistent with the request; distinguish disclosed proposals from claimed compatibility. Missing credentials/generated source may leave precise account/live-runtime blockers, but do not justify silent-success stubs for known behavior. Never infer hidden Paragon SDK, target connector envelope, empty-string validation semantics, extra-key policy, exactly-once sending or mandatory target timeout. Build/check scripts are checked separately. Cite concrete evidence and user consequence. Use 1 for supported satisfaction, 0 for a concrete unmet outcome, and abstain when essential evidence is absent/truncated instead of inferring a defect.`,
});
export default defineEvalCase({
  id: "prismatic-migrate-integration/paragon-send-slack-message",
  prompt: `${skillPrompt}Work entirely in the current directory. The supplied files are legacy integration inputs. Deliver a locally buildable Prismatic Code Native Integration in a new top-level subdirectory. Do not mutate Prismatic or connected services. Use local fixtures and mocked service calls for verification.\n\n${await read("REQUEST.txt")}`,
  persona: `${await read("PERSONA.md")}\nRespond as this stakeholder using only supplied facts. Do not volunteer reviewer tests or coach implementation. Routine implementation choices belong to the agent.`,
  fixtures: { kind: "dir", path: resolve(packet, "input") },
  assertions: [
    { id: "completed", type: "run-succeeded" },
    ...(["build", "checks"] as const).map(
      (mode): BuiltinAssertion => ({
        id: mode === "build" ? "local-build" : "project-checks",
        type: "command-exits-zero",
        command: `node ${quote(verifier)} . ${mode}`,
        inheritEnv: ["PATH"],
        timeout: "4 minutes",
      }),
    ),
    rubric(
      "message-sender-and-caller",
      "Deliver a useful locally callable send operation preserving the declared message value, connected person's sender intent, and caller JSON property status whose value is selected from the completed send's ok. Distinguish that literal body property from the HTTP status code: silently returning an ok property instead changes the caller contract. Cite the source response expression and the delivered registered result/caller adapter and effective JSON, rather than accepting comments or helper-only returns as proof. A helper return or queued execution ID alone does not establish that caller result. An explicit proposed caller change can be useful if its effect is clear; do not silently replace the connected person with a shared bot. Account-specific setup may remain a precisely identified dependency. Respect the test-only channel and keep Salesforce/sync work outside scope.",
    ),
    rubric(
      "validation-and-failure",
      "Implement the declared required-string input boundary before sending and handle failure of the selected target send operation without taking an ordinary apparent-success path. Ground result envelopes and failure forms in that operation's actual contract. Preserve the explicit no-step-retry/stop-on-error intention or explain a proposed change. Do not invent Paragon wrapper behavior or guarantee no message was accepted after an ambiguous transport failure. No exact hosted source error envelope is required.",
    ),
    rubric(
      "meaningful-local-verification",
      "Provide meaningful local verification of the delivered registered caller/send/result path and a consequential failure, using the chosen target interface faithfully. Include evidence that message values and sender/account routing are not silently changed. Accept equivalent scenarios and techniques; no fixed test inventory or live credentials are required. Source declaration checks establish source facts only. Missing coverage is a verification gap, not proof correct implementation is absent.",
    ),
    rubric(
      "truthful-bounded-handoff",
      "Explain the useful local result, actual verification, proposed caller/configuration changes and concrete account/deployment decisions still needed. Distinguish workflow declarations from absent generated integration code, source account settings and unverified hosted behavior. Explain how the connected-person sender will be established or what evidence remains necessary. Do not claim live compatibility, activation or successful sending from mocks, or demand recovery of unrelated out-of-scope workflows before delivering the bounded part.",
    ),
  ],
  meta: {
    skill: variant === "none" ? "none" : selectedSkill,
    variant,
    tags: ["migration", "paragon", "train", "supplemental-feasibility"],
  },
});
