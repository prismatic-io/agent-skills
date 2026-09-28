import { basename, resolve } from "node:path";
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

const prismEnv = [
  "PRISMATIC_URL",
  "PRISM_PROFILE",
  "PRISM_CONFIG_FILE",
  "PRISM_ACCESS_TOKEN",
  "PRISM_REFRESH_TOKEN",
  "PRISMATIC_TENANT_ID",
];
export const prismBin = resolve(
  import.meta.dirname,
  ".lux-cache",
  basename(process.env.PRISM_ROOT ?? "prism"),
  "bin",
);
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
      `${spec.contract && id !== "nondeveloper-experience" ? `Authoritative service contract for this case: ${spec.contract}\n\n` : ""}${criteria}\n\nGrade only this criterion on a continuous 0–1 scale: 0 absent, 0.25 limited, 0.5 partial, 0.75 solid, 1 strong. Strong means sufficient for this task, not exhaustive. Give proportional credit for working parts and explain one observed strength and the highest-impact improvement; do not force a bell curve. Local mocked verification is expected; live service verification is not required. For implementation criteria, inspect the actual code; score missing test coverage under meaningful-tests, not as proof that correct code is unimplemented. Build, test execution, publication, and baseline compatibility are independently checked by component-checks; do not demand their command output in this source-focused evidence. Files selected (N of M) counts evidence-selector matches among captured artifacts, not failed capture. Do not infer missing tests solely from N < M or speculate about unlisted test files. Judge the supplied inventory and contents; abstain when relevant evidence is actually unavailable or incomplete.`,
      overrides,
    );
  return [
    { id: "completed", type: "run-succeeded" },
    {
      id: "component-checks",
      type: "command-exits-zero",
      command: `node ${shellQuote(resolve(import.meta.dirname, "check-component.ts"))}${spec.mode === "edit" && spec.fixture ? ` --baseline ${shellQuote(spec.fixture)} --case-id ${shellQuote(spec.id)}` : ""}`,
      env: {
        PATH: `${prismBin}:${process.env.PATH}`,
        PRISM_AGENT: "1",
      },
      inheritEnv: prismEnv,
      timeout: "10 minutes",
    },
    ...(spec.operations.length
      ? [
          rubric(
            "requested-operations",
            `The artifacts implement and register usable Spectral actions for these ${spec.service} operations: ${list(spec.operations)}. Reject stubs, invented API methods, and silently omitted operations. Documented service limitations must be explained with an actionable alternative rather than presented as implemented functionality. Newly introduced actions must serve the requested workflow; retaining unrelated generated endpoints fails this criterion. Preserve pre-existing actions when editing a component. Grade triggers separately.`,
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
            `The agent's explanation of ${spec.service} capabilities and of its chosen mechanisms is factually accurate. Known facts: ${spec.facts} Choosing a simpler supported mechanism is acceptable; misstating what the service supports fails this criterion. Assess factual claims actually made. Omitting unchosen supported alternatives does not imply they do not exist; no alternatives catalog is required. Identify the contradicted statement when assigning a factual-accuracy failure.`,
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
            `Score authored tests as continuous evidence of the requested behavior. Relevant scenarios include: ${list(spec.tests)}.${spec.apiFailure === false ? " This change does not require a new API failure test." : " A genuine API failure path strengthens confidence; one is enough, without repeating it for every action."} Give proportional credit for correctly exercised paths and discriminating assertions. A missing boundary reduces confidence rather than making all useful coverage worthless. Prefer tests that exercise registered behavior and service-shaped responses; equivalent approaches are valid. Scaffold tests, assertions detached from the implementation, or a claim that tests passed provide little evidence. Mocks that repeat an incorrect assumption weaken confidence. Existing baseline tests support compatibility but do not alone prove the requested change. For metadata-only changes, registered metadata assertions plus existing runtime coverage can suffice; do not require a schema library or duplicate runtime tests.`,
          ),
        ]
      : []),
    ...(spec.criteria ?? []).map(({ id, criteria }) => rubric(id, criteria)),
    ...(spec.preserved?.length
      ? [
          rubric(
            "backward-compatibility",
            `The existing component remains compatible: ${list(spec.preserved)}. The authorized sandbox component-key change is not a regression. Inspect implementation and tests; do not accept claims alone.`,
          ),
        ]
      : []),
    rubric(
      "nondeveloper-experience",
      "Grade communication and interaction only. The agent proceeds without asking the user to choose API endpoints, authentication protocols, SDK architecture, or create-versus-modify modes; any questions concern missing business needs in plain language. The handoff explains the requested operations or trigger setup and states what verification was performed. For new components or changed setup, name credentials and setup still needed. For edits retaining existing configuration, do not require repeating unchanged credentials; explain new setup and what remains reusable when relevant. Naming credentials and actions, then describing mocked tests and sandbox publication, is sufficient to distinguish local testing from publication; an explicit 'not live-tested' disclaimer is not required. Do not require UI click-by-click instructions or a tutorial. Award full credit when these conditions are met; assess implementation correctness and test coverage only under their separate assertions.",
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
  const continuation = process.env.PRISM_EVAL_FIXTURE;
  if (continuation && spec.fixture) {
    throw new Error(
      "PRISM_EVAL_FIXTURE cannot replace an authored case fixture",
    );
  }
  if (spec.mode === "edit" && !spec.fixture) {
    throw new Error("Edit cases require an authored component fixture");
  }
  const fixture = spec.fixture ?? continuation;
  const workspace =
    spec.mode === "edit"
      ? "Modify the existing component in the current directory. Preserve existing action, trigger, connection, and input keys except where the request explicitly changes them. Change only the component key to a fresh sandbox key for this run; do not publish over the original fixture key."
      : "Work in the current directory. Supplied specs or documentation are inputs for a new component.";
  // Keep authorization and its limits together before the detailed procedure.
  // Native permission reviewers may see only a short prefix of the user turn.
  const scope = `${spec.mode === "edit" ? "Update the existing" : "Build the requested"} connector in this workspace. Use mocked service calls. Publish only a fresh ${spec.id}-lux-* component key to the authenticated Prismatic sandbox; leave it for review. Do not change other components or live service accounts.`;
  return defineEvalCase({
    id: `prismatic-components/${spec.id}`,
    prompt: `${scope}\n\n${spec.request}\n\nUse the skill at ${subjectPath("prismatic-components/SKILL.md")}. ${workspace} Prism is already installed at ${resolve(prismBin, "prism")}. Run that executable with --version first and use it for all Prism commands; do not download a replacement through npx. Use Prism's existing authentication and verify the published component is available.`,
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
        continuation ? "continuation" : "train",
      ],
    },
  });
};
