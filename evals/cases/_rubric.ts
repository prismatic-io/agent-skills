import type { BuiltinAssertion, RubricEvidence } from "@prismatic-io/lux";

// Source-focused grading and interaction grading have different trace budgets.
// Keep domain interpretation in the calling case factory.
export const sourceRubrics = (policy: {
  artifactPatterns: string[];
  sourceGuidance: string;
  qualityGuidance: string;
  timeout?: string;
}) => {
  const evidence = {
    artifactPatterns: policy.artifactPatterns,
    eventTypes: ["terminal"],
    toolDetail: "names",
    includeArtifactContents: true,
    maxEvents: 10,
    maxAgentChars: 2_000,
    maxToolChars: 2_000,
    maxArtifactChars: 80_000,
  } satisfies Partial<RubricEvidence>;
  return (
    id: string,
    criteria: string,
    interaction = false,
    mode: "required" | "informational" = "required",
  ): BuiltinAssertion => ({
    id,
    type: "rubric",
    scoring: "continuous",
    ...(mode === "informational"
      ? { informational: true }
      : { threshold: 0.8 }),
    ...(policy.timeout ? { timeout: policy.timeout } : {}),
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
          toolInvocations: "all",
          maxEvents: 200,
          maxAgentChars: 30_000,
          maxToolChars: 60_000,
        }
      : evidence,
    maxArtifactExcerpt: 20_000,
    criteria: `${criteria}${interaction ? "" : policy.sourceGuidance}\n\nScore this criterion continuously from 0 to 1 in proportion to the requested outcomes demonstrated, weighting their importance to the user. Credit independently working parts even when another part is missing or incorrect. Use intermediate values throughout the range; do not round to a verdict, impose score bands, or change a score to cross an acceptance threshold. Zero means no demonstrated credit and one means the requested outcome is fully demonstrated. Optional polish is not part of the denominator. Explain the evidence, strengths, and remaining gaps without inventing shortcomings. ${policy.qualityGuidance}`,
  });
};
