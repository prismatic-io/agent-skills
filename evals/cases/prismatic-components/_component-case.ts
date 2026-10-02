import { resolve } from "node:path";
import {
  type BuiltinAssertion,
  defineEvalCase,
  type RubricEvidence,
  subjectPath,
} from "@prismatic-io/lux";

export interface ComponentCase {
  id: string;
  service: string;
  request: string;
  persona: string;
  operations: string[];
  trigger?: string;
  facts?: string;
  tests: string[];
  tags?: string[];
  fixture?: string;
  mode?: "create" | "edit";
  criteria?: { id: string; criteria: string }[];
  preserved?: string[];
  apiFailure?: boolean;
  contract?: string;
}

const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const list = (items: string[]) => items.join(", ");
const evidence = {
  artifactPatterns: [
    "**/*.ts",
    "**/*.mts",
    "**/*.cts",
    "**/*.js",
    "**/*.mjs",
    "**/*.cjs",
    "**/package.json",
    "**/API.md",
  ],
  eventTypes: ["terminal"],
  toolDetail: "names",
  maxEvents: 10,
  maxArtifactChars: 80_000,
  maxAgentChars: 2_000,
  maxToolChars: 2_000,
} satisfies Partial<RubricEvidence>;
const makeRubric = (
  id: string,
  criteria: string,
  overrides: Partial<RubricEvidence> = {},
): BuiltinAssertion => ({
  id,
  type: "rubric",
  scoring: "continuous",
  ...(["meaningful-tests", "nondeveloper-experience"].includes(id)
    ? { informational: true }
    : { threshold: 0.8 }),
  evidence: { ...evidence, ...overrides },
  maxArtifactExcerpt: 20_000,
  criteria,
});

export const componentAssertions = (
  spec: ComponentCase,
): BuiltinAssertion[] => {
  const rubric = (
    id: string,
    criteria: string,
    overrides: Partial<RubricEvidence> = {},
  ) =>
    makeRubric(
      id,
      `${spec.contract && id !== "nondeveloper-experience" ? `Authoritative service contract for this case: ${spec.contract}\n\n` : ""}${criteria}\n\nLocal mocked verification is expected; live service verification is not required. For implementation criteria, inspect the actual code; score missing test coverage under meaningful-tests, not as proof that correct code is unimplemented. Build, test execution, registered behavior, and baseline compatibility are independently checked by component-checks; publication is assessed separately by platform-scope; do not demand their command output in this source-focused evidence.`,
      overrides,
    );
  return [
    { id: "completed", type: "run-succeeded" },
    {
      id: "component-checks",
      type: "command-exits-zero",
      requiresExecutionWorkspace: true,
      command: `node ${shellQuote(resolve(import.meta.dirname, "_check-component.ts"))}${spec.mode === "edit" && spec.fixture ? ` --baseline ${shellQuote(spec.fixture)} --case ${shellQuote(resolve(import.meta.dirname, `${spec.id}.ts`))}` : ""}`,
      env: { PATH: process.env.PATH ?? "", CI: "true" },
      inheritEnv: [],
      timeout: "10 minutes",
    },
    ...(spec.operations.length
      ? [
          rubric(
            "requested-operations",
            `The artifacts implement and register usable Spectral actions for these ${spec.service} operations: ${list(spec.operations)}. Give credit for working operations; stubs, invented API methods, and omitted operations do not establish those capabilities. Documented service limitations must be explained with an actionable alternative rather than presented as implemented functionality. Newly introduced actions must serve the requested workflow; unrelated generated endpoints do not add credit. Preserve pre-existing actions when editing a component. Grade triggers separately.`,
          ),
        ]
      : []),
    ...(spec.trigger
      ? [
          rubric(
            "trigger",
            `A registered trigger satisfies this need using documented ${spec.service} behavior: ${spec.trigger}. Its configuration, event filtering, and lifecycle or persisted polling state make it usable across repeated executions. Assess the requested business events, not a fixed event-name allowlist; documented external filtering can satisfy the requirement. Polling must handle documented pagination without advancing state past unprocessed changes. Any implemented webhook verification must match the documented protocol and enforce its configured checks. A generic trigger that forwards any incoming payload without establishing the requested event semantics does not satisfy this criterion.`,
            {
              artifactPatterns: [...evidence.artifactPatterns, "**/*.md"],
              eventTypes: ["agent-message", "terminal"],
              maxEvents: 30,
              maxAgentChars: 10_000,
            },
          ),
        ]
      : []),
    ...(spec.facts
      ? [
          rubric(
            "documentation-accuracy",
            `The agent's explanation of ${spec.service} capabilities and of its chosen mechanisms is factually accurate. Known facts: ${spec.facts} Choosing a simpler supported mechanism is acceptable; deduct proportionally for material misstatements about what the service supports. Assess factual claims actually made. Omitting unchosen supported alternatives does not imply they do not exist; no alternatives catalog is required. Identify the contradicted statement when assigning a factual-accuracy failure.`,
            {
              eventTypes: ["agent-message", "terminal"],
              maxEvents: 30,
              maxAgentChars: 10_000,
            },
          ),
        ]
      : []),
    ...(spec.tests.length
      ? [
          rubric(
            "meaningful-tests",
            `Assess authored tests for the requested behavior. Relevant scenarios include: ${list(spec.tests)}.${spec.apiFailure === false ? " This change does not require a new API failure test." : " A genuine API failure path strengthens confidence; one is enough, without repeating it for every action."} A missing boundary reduces confidence rather than making all useful coverage worthless. Prefer tests that exercise registered behavior and service-shaped responses; equivalent approaches are valid. Scaffold tests, assertions detached from the implementation, or a claim that tests passed provide little evidence. Mocks that repeat an incorrect assumption weaken confidence. Existing baseline tests support compatibility but do not alone prove the requested change. For metadata-only changes, registered metadata assertions plus existing runtime coverage can suffice; do not require a schema library or duplicate runtime tests.`,
          ),
        ]
      : []),
    ...(spec.criteria ?? []).map(({ id, criteria }) => rubric(id, criteria)),
    ...(spec.preserved?.length
      ? [
          rubric(
            "backward-compatibility",
            `The existing component remains compatible: ${list(spec.preserved)}. The authorized fresh component-key change is not a regression. Inspect implementation and tests; do not accept claims alone.`,
          ),
        ]
      : []),
    {
      id: "platform-scope",
      type: "rubric",
      scoring: "continuous",
      threshold: 0.8,
      evidence: {
        ...evidence,
        eventTypes: ["agent-message", "tool-call", "tool-result", "terminal"],
        toolDetail: "inputs-and-results",
        toolInvocations: "all",
        maxEvents: 200,
        maxAgentChars: 20_000,
        maxToolChars: 60_000,
      },
      criteria:
        "Executed Prism results establish publication and availability of the requested fresh component in the target Prismatic organization. For requested changes to designer inputs, outputs, or triggers, assess published member metadata against the requested capability. A separately built review copy may have a different key, label, or directory from the maintained source project; matching that source project’s identity or package signature is not required. Credit demonstrated publication, availability, and requested configuration proportionally while preserving unrelated platform resources and external-service accounts. The handoff must not claim customer deployment or live external-service verification without evidence. No real credentials may be printed, embedded in source, or exposed in command literals. Final claims alone do not establish publication.",
    },
    rubric(
      "nondeveloper-experience",
      "Grade communication and interaction only. The agent proceeds without asking the user to choose API endpoints, authentication protocols, SDK architecture, or create-versus-modify modes; any questions concern missing business needs in plain language. The handoff explains the requested operations or trigger setup and states what verification was performed. For new components or changed setup, name credentials and setup still needed. For edits retaining existing configuration, do not require repeating unchanged credentials; explain new setup and what remains reusable when relevant. Naming credentials and actions, then describing mocked tests and publication to the target organization, is sufficient to distinguish local testing from publication; an explicit 'not live-tested' disclaimer is not required. Do not require UI click-by-click instructions or a tutorial. Award full credit when these conditions are met; assess implementation correctness and test coverage only under their separate assertions.",
      {
        artifactPatterns: ["**/*.md"],
        maxArtifactChars: 10_000,
        eventTypes: ["agent-message", "interrupt", "responded", "terminal"],
        maxEvents: 100,
        maxAgentChars: 30_000,
      },
    ),
  ];
};

export const defineComponentCase = (spec: ComponentCase) => {
  if (spec.mode === "edit" && !spec.fixture) {
    throw new Error("Edit cases require an authored component fixture");
  }
  const fixture = spec.fixture;
  const workspace =
    spec.mode === "edit"
      ? "Update the component in this directory without breaking existing integrations."
      : "Build the new component in this directory using the supplied documentation where available.";
  // Keep authorization and its limits together before the detailed procedure.
  // Native permission reviewers may see only a short prefix of the user turn.
  const scope = `${spec.mode === "edit" ? "Update the existing" : "Build the requested"} connector here and test it with mocked service calls. Publish a new review copy to our Prismatic organization and check that it is available. Leave it for review without changing other components or live service accounts.`;
  return defineEvalCase({
    id: `prismatic-components/${spec.id}`,
    prompt: `${scope}\n\n${spec.request}\n\nUse the skill at ${subjectPath("prismatic-components/SKILL.md")}. ${workspace}`,
    ...(fixture
      ? { fixtures: { kind: "dir" as const, path: resolve(fixture) } }
      : {}),
    persona: spec.persona,
    assertions: componentAssertions(spec),
    meta: {
      tags: [
        "components",
        spec.id,
        ...(spec.tags ?? []),
        spec.mode ?? "create",
        "train",
      ],
    },
  });
};
