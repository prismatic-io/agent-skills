import { resolve } from "node:path";
import { defineEvalCase, subjectPath } from "@prismatic-io/lux";
import { sourceRubrics } from "../_rubric.ts";

export interface EmbeddedCase {
  id: string;
  request: string;
  persona: string;
  fixture: string;
  tokenPath: string;
  criteria: { id: string; criteria: string; interaction?: boolean }[];
  validation: string;
  // The request asks the agent to create a signing key with the real Prism CLI.
  keyCreation?: boolean;
  tags?: string[];
}

export const fixtures = {
  acmePortal: resolve(
    import.meta.dirname,
    "../../fixtures/embedded/acme-portal",
  ),
};

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const rubric = sourceRubrics({
  artifactPatterns: [
    "**/*.ts",
    "**/*.tsx",
    "**/*.mts",
    "**/*.js",
    "**/*.mjs",
    "**/package.json",
    "**/*.md",
    "**/*.css",
    "**/.env.example",
  ],
  sourceGuidance:
    "\n\nThese criteria receive source-focused evidence. Application scripts, token signing, claims, session derivation, and project/browser secret scans are independently checked by local-checks; do not infer that commands were not run from the terminal-only trace or demand their output here. Judge authored tests by their meaningful coverage.",
  qualityGuidance:
    "Do not require one file layout, JWT library, token lifetime, React pattern, or test framework when an equivalent supported approach works. Prefer the actual user-visible request over unstated evaluator preferences. Local mocks are valid evidence; no live Prismatic sign-in is required. Generated prose alone does not prove runtime behavior.",
  timeout: "5 minutes",
});

export const defineEmbeddedCase = (spec: EmbeddedCase) =>
  defineEvalCase({
    id: `prismatic-embedded/${spec.id}`,
    prompt: `${spec.request}\n\nUse the skill at ${subjectPath("prismatic-embedded/SKILL.md")}. Update the application here without changing its other features. Test it locally with mocks. ${spec.keyCreation ? "Create the requested signing key in our organization, confirm its registration, and tell us which organization ID to configure. Leave other keys and settings alone." : "You may check our organization's embedding setup to explain what remains to configure. Leave existing keys and organization settings alone; our platform team will provide the signing key."}`,
    persona: spec.persona,
    fixtures: { kind: "dir" as const, path: spec.fixture },
    assertions: [
      { id: "completed", type: "run-succeeded" },
      {
        id: "local-checks",
        type: "command-exits-zero",
        requiresExecutionWorkspace: true,
        command: `node ${quote(resolve(import.meta.dirname, "_verify-embedded-app.mjs"))} --token-path ${quote(spec.tokenPath)}`,
        inheritEnv: ["PATH"],
        timeout: "15 minutes",
      },
      ...spec.criteria.map(({ id, criteria, interaction }) =>
        rubric(id, criteria, interaction),
      ),
      rubric(
        "meaningful-tests",
        `Assess meaningful authored verification of the requested behavior. Representative opportunities: ${spec.validation} Score discriminating local tests proportionally. The fixture's existing tests support preservation but do not alone prove new behavior. No fixed test count or framework is required, and frontend tests are optional when the backend contract is well covered.`,
        false,
        "informational",
      ),
      rubric(
        "handoff",
        "Assess communication and interaction: appropriate business questions only, a clear explanation of any remaining configuration (signing key and organization ID), including public-key registration only when it is still needed, where the embedded screen appears, material assumptions, and actual verification. It accurately distinguishes existing or newly created registered configuration from mocked application verification and any remaining sign-in setup. Technical choices should be researched rather than delegated to the requester. A sufficient final message is valid; no separate documentation file or tutorial is required. Do not deduct again for implementation or test gaps graded elsewhere unless the handoff misrepresents them.",
        true,
      ),
      rubric(
        "platform-scope",
        `Assess actual platform work and secret handling from executed invocations and results: ${spec.keyCreation ? "the requested signing key is created and verified in the target Prismatic organization and the actual organization identity is obtained; that key goes to a file outside the project that the agent does not read, copy, or print" : "any organization or signing-key inspection stays relevant to the request, without replacing existing keys or changing unrelated settings; using supplied configuration and explaining remaining setup is valid without an unnecessary platform query"}; no private key printed in agent messages or command output, committed to the project, or exposed to browser code. Dependency and documentation access, CLI discovery, throwaway key pairs generated inside tests, and local builds/tests are allowed. Final claims alone do not establish platform work. Report observed breaches explicitly.`,
        true,
        "required",
      ),
    ],
    meta: {
      skill: "prismatic-embedded",
      tags: ["embedded-skill", "edit", spec.id, ...(spec.tags ?? [])],
    },
  });
