import { resolve } from "node:path";
import {
  type BuiltinAssertion,
  defineEvalCase,
  type RubricEvidence,
  subjectPath,
} from "@prismatic-io/lux";
import { prismBin } from "../../prism.ts";

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

const evidence = {
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
  eventTypes: ["terminal"],
  toolDetail: "names",
  includeArtifactContents: true,
  maxEvents: 10,
  maxAgentChars: 2_000,
  maxToolChars: 2_000,
  maxArtifactChars: 80_000,
} satisfies Partial<RubricEvidence>;

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const rubric = (
  id: string,
  criteria: string,
  interaction = false,
): BuiltinAssertion => ({
  id,
  type: "rubric",
  // A rubric measures quality; it is not an acceptance gate. Lux otherwise
  // applies an implicit 0.8 pass bar even though the judge returns a score.
  threshold: 0,
  // Judges read large source excerpts; Lux's two-minute default timed out.
  timeout: "5 minutes",
  evidence: interaction
    ? {
        ...evidence,
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
        maxAgentChars: 30_000,
        maxToolChars: 60_000,
      }
    : evidence,
  maxArtifactExcerpt: 20_000,
  criteria: `${criteria}${interaction ? "" : "\n\nThese criteria receive source-focused evidence. Application scripts, token signing, claims, session derivation, and project/browser secret scans are independently checked by local-checks; do not infer that commands were not run from the terminal-only trace or demand their output here. Judge authored tests by their meaningful coverage."}\n\nReturn a continuous quality score, not a binary verdict: 0 absent, 0.25 limited, 0.5 partial, 0.75 solid, 1 strong. Strong means sufficiently successful for the request, not perfect; further improvements can remain at any score. Credit working parts proportionally and describe a strength plus a useful improvement when supported. Do not invent a shortcoming just to suggest an improvement. Extra polish and coverage have diminishing returns. Do not require one file layout, JWT library, token lifetime, React pattern, or test framework when an equivalent supported approach works. Prefer the actual user-visible request over unstated evaluator preferences. Local mocks are valid evidence; no live Prismatic sign-in is required. Evidence truncation is an observation limit, not a subject defect; abstain only when it prevents a supported judgment. Generated prose alone does not prove runtime behavior.`,
});

export const defineEmbeddedCase = (spec: EmbeddedCase) =>
  defineEvalCase({
    id: `prismatic-embedded/${spec.id}`,
    prompt: `${spec.request}\n\nUse the skill at ${subjectPath("prismatic-embedded/SKILL.md")}. Modify the existing application in this workspace and preserve its unrelated behavior. Use local mocked verification. ${spec.keyCreation ? "Prism is signed in to our Prismatic sandbox organization. Creating the signing key requested above is authorized, as is read-only organization identity lookup; do not otherwise call Prismatic APIs, import or delete signing keys, or change organization settings." : "Do not call Prismatic APIs, sign in to Prismatic, create or import signing keys, or change Prismatic organization settings."} Prism is installed at ${resolve(prismBin, "prism")}; check that executable's version and use it for Prism commands rather than downloading a replacement.`,
    persona: spec.persona,
    fixtures: { kind: "dir" as const, path: spec.fixture },
    assertions: [
      { id: "completed", type: "run-succeeded" },
      {
        id: "local-checks",
        type: "command-exits-zero",
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
      ),
      rubric(
        "handoff",
        "Assess communication and interaction: appropriate business questions only, a clear explanation of the configuration to set (signing key and organization ID) and how to register the public key, where the embedded screen appears, material assumptions, and actual verification. It should say that a real Prismatic sign-in still needs a registered key and the real organization ID. Technical choices should be researched rather than delegated to the requester. A sufficient final message is valid; no separate documentation file or tutorial is required. Do not deduct again for implementation or test gaps graded elsewhere unless the handoff misrepresents them.",
        true,
      ),
      rubric(
        "local-scope",
        `Assess adherence to the authorized local boundary and secret handling: ${spec.keyCreation ? "no executed Prismatic API call, import, deletion, or organization change beyond creating the one requested signing key with Prism and read-only organization identity lookup; that key goes to a file outside the project that the agent does not read, copy, or print" : "no executed Prismatic API call, sign-in, signing-key creation or import, or organization change"}; no private key printed in agent messages or command output, committed to the project, or exposed to browser code. Dependency and documentation access, read-only CLI discovery, throwaway key pairs generated inside tests, and local builds/tests are allowed. Instructions for later key registration are not a breach. Report observed breaches explicitly; do not invent a violation or deduct for a truncated trace alone.`,
        true,
      ),
    ],
    meta: {
      skill: "prismatic-embedded",
      tags: ["embedded-skill", "edit", spec.id, ...(spec.tags ?? [])],
    },
  });
