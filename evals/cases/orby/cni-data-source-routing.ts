import {
  defineEvalCase,
  type RubricEvidence,
  subjectPath,
} from "@prismatic-io/lux";

const evidence = {
  artifactPatterns: ["package.json", "src/**/*.ts", "tests/**/*"],
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
  includeArtifactContents: true,
  maxEvents: 160,
  maxAgentChars: 25_000,
  maxToolChars: 60_000,
  maxArtifactChars: 40_000,
} satisfies Partial<RubricEvidence>;

export default defineEvalCase({
  id: "orby/cni-data-source-routing",

  fixtures: {
    kind: "dir",
    path: "../../fixtures/orby-cni-data-source",
  },
  prompt: `Use Orby at ${subjectPath("orby/SKILL.md")}. Work in the current project.

Update my Salesforce Sync CNI so deployers choose the Salesforce record type from a list
instead of typing it. Publish its component and import a new review copy of the integration, then check that it is available. Leave existing components and integrations alone. Test with mocked Salesforce calls; do not deploy a customer instance or access live Salesforce data.`,
  persona:
    "You maintain Salesforce Sync for customers. You want deployers to choose a Salesforce record type by its name instead of looking up an identifier. The project is the available technical context; you do not know which Prismatic API or skill should implement this. Salesforce credentials are unavailable. You want a separate Prismatic review copy and no customer deployment or live Salesforce access.",
  assertions: [
    { id: "completed", type: "run-succeeded" },
    {
      id: "real-project-builds",
      type: "command-exits-zero",
      command:
        "npm install --ignore-scripts && npm run typecheck && npm run build",
      timeout: "4 minutes",
    },
    {
      id: "routes-to-integration-skill",
      type: "rubric",
      scoring: "continuous",
      threshold: 0.9,
      evidence,
      criteria: `Grade only this criterion, not the whole task. Score continuously from 0 to 1 in proportion to demonstrated requested outcomes, weighted by their importance. Credit working parts independently; do not round to a verdict or change the score to cross an acceptance threshold. Only requested outcomes belong in the denominator; optional polish does not lower the score. Orby recognizes an existing Code Native Integration and uses the canonical
installed prismatic-integrations skill to make the change in place. It does not treat this
as a platform-operation request or stop after recommending a skill. A successful named invocation or
reading and applying the canonical skill file both establish explicit loading. Reading another
skill while choosing the specialist is allowed; grade the implementation route actually taken.`,
    },
    {
      id: "implements-record-type-data-source",
      type: "rubric",
      scoring: "continuous",
      threshold: 0.85,
      evidence,
      maxArtifactExcerpt: 20_000,
      criteria: `Grade only this criterion, not the whole task. Score continuously from 0 to 1 in proportion to demonstrated requested outcomes, weighted by their importance. Credit working parts independently; do not round to a verdict or change the score to cross an acceptance threshold. Only requested outcomes belong in the denominator; optional polish does not lower the score. The specialist handoff produces a useful local result: the Salesforce Record Type
deployer field is changed from a raw string to a Spectral data-source configuration variable
backed by a Salesforce record-type data source and the existing Salesforce connection. Judge the
handoff and successful project build; detailed specialist correctness belongs to the
prismatic-integrations skill's evaluations.`,
    },
    {
      id: "platform-publication",
      type: "rubric",
      scoring: "continuous",
      threshold: 0.8,
      evidence,
      criteria: `Grade only this criterion, not the whole task. Score continuously from 0 to 1 in proportion to demonstrated requested outcomes, weighted by their importance. Credit working parts independently; do not round to a verdict or change the score to cross an acceptance threshold. Only requested outcomes belong in the denominator; optional polish does not lower the score. Executed Prism results establish component publication and import and verification of a fresh review integration in the target Prismatic organization. The final answer reports actual checks and publication without claiming customer deployment or live Salesforce behavior. Preserve unrelated resources and external accounts. Final claims or planned commands do not establish publication; abstain if necessary evidence is missing or truncated.`,
    },
  ],
  meta: {
    skill: "orby",
    tags: ["orby", "routing", "integration-skill", "train"],
  },
});
