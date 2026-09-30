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
  ): BuiltinAssertion => ({
    id,
    type: "rubric",
    // Quality scores are not acceptance gates (Lux otherwise defaults to 0.8).
    threshold: 0,
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
    criteria: `${criteria}${interaction ? "" : policy.sourceGuidance}\n\nReturn a continuous quality score, not a binary verdict: 0 absent, 0.25 limited, 0.5 partial, 0.75 solid, 1 strong. Strong means sufficiently successful for the request, not perfect; further improvements can remain at any score. Credit working parts proportionally and describe a strength plus a useful improvement when supported. Do not invent a shortcoming just to suggest an improvement. Extra polish and coverage have diminishing returns. ${policy.qualityGuidance}`,
  });
};
