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
      `${spec.contract && id !== "nondeveloper-experience" ? `Authoritative service contract for this case: ${spec.contract}\n\n` : ""}${criteria}\n\nGrade only this criterion. Local mocked verification is expected; live service verification is not required. For implementation criteria, inspect the actual code; score missing test coverage under meaningful-tests, not as proof that correct code is unimplemented. Build, test execution, publication, and baseline compatibility are independently checked by component-checks; do not demand their command output in this source-focused evidence.`,
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
      timeoutMs: 600_000,
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
            `A registered trigger satisfies this need using documented ${spec.service} behavior: ${spec.trigger}. Its configuration, event filtering, and lifecycle or persisted polling state make it usable across repeated executions. A generic trigger that forwards any incoming payload without establishing the requested event semantics does not satisfy this criterion.`,
          ),
        ]
      : []),
    ...(spec.facts
      ? [
          rubric(
            "documentation-accuracy",
            `The agent's explanation of ${spec.service} capabilities and of its chosen mechanisms is factually accurate. Known facts: ${spec.facts} Choosing a simpler supported mechanism is acceptable; misstating what the service supports fails this criterion.`,
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
            `Tests exercise the requested behavior, including: ${list(spec.tests)}.${spec.apiFailure === false ? " This change does not require a new API failure test." : " Include an API failure path. One genuine API failure test is sufficient; do not require failure tests for every action."} Merely retaining scaffold tests, asserting only constants detached from the registered implementation, or claiming tests passed is insufficient. Existing baseline tests establish compatibility, not completion of the requested change. For metadata-only changes, assertions on actual registered metadata against the expected contract, together with existing runtime coverage, are meaningful; a schema-validation library or duplicate runtime tests are not required.`,
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
      "Grade communication and interaction only. The agent proceeds without asking the user to choose API endpoints, authentication protocols, SDK architecture, or create-versus-modify modes; any questions concern missing business needs in plain language. The handoff names any connection credentials still needed and the requested operations or trigger setup, and states what verification was performed. Naming credentials and actions, then describing mocked tests and sandbox publication, is sufficient to distinguish local testing from publication; an explicit 'not live-tested' disclaimer is not required. Do not require UI click-by-click instructions or a tutorial. Award full credit when these conditions are met; assess implementation correctness and test coverage only under their separate assertions.",
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
  return defineEvalCase({
    id: `prismatic-components/${spec.id}`,
    prompt: `Use the skill at ${subjectPath("prismatic-components/SKILL.md")}. ${workspace} Use mocked service calls for verification. Use Prism's existing authentication. Publish to the Prismatic sandbox using a fresh ${spec.id}-lux-* component key and verify it is available. Leave it for review. Do not change other components or live ${spec.service} accounts.\n\n${spec.request}`,
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
