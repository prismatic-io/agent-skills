import { resolve } from "node:path";
import {
  defineEvalCase,
  type RubricEvidence,
  subjectPath,
} from "@prismatic-io/lux";

const request =
  "I need to build a low-code integration with files.com. Look up docs and build a custom connector I can use. I need a trigger that runs when a file is changed. I also need actions for uploading/downloading files, list files, creating folders, moving files, encrypting/decrypting files, etc.";
const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const evidence = {
  artifactPatterns: ["**/*.ts", "**/package.json", "**/*.md"],
  eventTypes: [
    "agent-message",
    "tool-call",
    "tool-result",
    "interrupt",
    "responded",
    "terminal",
  ],
  toolDetail: "inputs-and-results",
  maxEvents: 200,
  maxArtifactChars: 80_000,
  maxToolChars: 60_000,
} satisfies Partial<RubricEvidence>;

export default defineEvalCase({
  id: "prismatic-components/files-com",
  prompt: `Use the skill at ${subjectPath("prismatic-components/SKILL.md")}. Work in the current directory. Use Prism's existing authentication. Publish to the Prismatic sandbox using a fresh files-com-lux-* component key and verify it is available. Leave it for review. Do not change other components or live Files.com accounts.\n\n${request}`,
  ...(process.env.PRISM_EVAL_FIXTURE
    ? {
        fixtures: {
          kind: "dir" as const,
          path: resolve(process.env.PRISM_EVAL_FIXTURE),
        },
      }
    : {}),
  persona: `You build integrations in Prismatic's low-code designer and do not write code.
You need a reusable Files.com connector. You do not know API endpoints, authentication
protocols, SDKs, or the difference between webhooks and polling. You want to react
when files are added or their contents change; a delay of a few minutes is acceptable.
You want to encrypt files for a partner and decrypt files they send you. You do not
have Files.com credentials or encryption keys available in this session. Publish
the connector to the authenticated Prismatic sandbox so I can use it in the low-code
designer. Do not change live Files.com accounts. You have no preferences about
code structure or libraries.`,
  assertions: [
    { id: "completed", type: "run-succeeded" },
    {
      id: "component-checks",
      type: "command-exits-zero",
      command: `node ${shellQuote(resolve(import.meta.dirname, "../check-component.ts"))}`,
      timeoutMs: 300_000,
    },
    {
      id: "sandbox-publication",
      type: "tool-invocation",
      name: "Bash",
      result: "success",
      input: { matches: "prism components publish" },
      output: {
        matches: 'Successfully published |"available":true',
      },
    },
    {
      id: "requested-actions",
      type: "rubric",
      evidence,
      maxArtifactExcerpt: 20_000,
      criteria:
        "The artifacts implement and register usable Spectral actions for uploading and downloading file bytes, listing files, creating folders, moving files, and encrypting and decrypting files. Reject stubs, invented API methods, and silently omitted operations. Documented service limitations must be explained with an actionable alternative rather than presented as implemented functionality. Grade these seven operations only; trigger choice and extra actions are evaluated separately or are optional.",
    },
    {
      id: "file-change-trigger",
      type: "rubric",
      evidence,
      maxArtifactExcerpt: 20_000,
      criteria:
        "A registered trigger detects added files and changed file contents using documented Files.com behavior. Its configuration, event filtering, and lifecycle or persisted polling state make it usable across repeated executions. Either webhooks or scheduled polling is acceptable; do not penalize polling. A generic trigger that forwards any incoming payload without establishing file-change semantics does not satisfy this criterion.",
    },
    {
      id: "documentation-accuracy",
      type: "rubric",
      evidence,
      criteria:
        "The explanation of the chosen event mechanism is factually accurate. Files.com supports outbound HTTP webhooks for file activity (https://www.files.com/docs/automation-and-flow/notifications/webhooks). Polling is acceptable, but claiming Files.com only supports email notifications or has no outbound webhooks fails this criterion.",
    },
    {
      id: "meaningful-tests",
      type: "rubric",
      evidence,
      maxArtifactExcerpt: 20_000,
      criteria:
        "Tests exercise the generated implementation, including file-byte preservation in transfer, file-change trigger behavior across events or polls, and an API failure. Merely retaining scaffold tests, asserting constants, or claiming tests passed is insufficient.",
    },
    {
      id: "nondeveloper-experience",
      type: "rubric",
      evidence: {
        ...evidence,
        artifactPatterns: ["**/*.md"],
        maxArtifactChars: 20_000,
      },
      criteria:
        "The agent makes progress from the request without an upfront questionnaire or asking the user to choose API endpoints, auth protocols, SDK architecture, or create-versus-modify modes. Any questions address missing business needs in plain language. The final handoff explains how to configure and use the connector in the low-code designer and distinguishes local tests from live verification and publication. A concise handoff is sufficient; do not require a lengthy UI tutorial.",
    },
  ],
  meta: {
    tags: [
      "components",
      "files-com",
      process.env.PRISM_EVAL_FIXTURE ? "continuation" : "train",
    ],
  },
});
