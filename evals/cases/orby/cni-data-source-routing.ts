import {
  defineEvalCase,
  type RubricEvidence,
  subjectPath,
} from "@prismatic-io/lux";
import { localProjectEnvironment } from "./_environment.ts";

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
${localProjectEnvironment}

Update my Salesforce Sync CNI so deployers select the Salesforce record type through a data source
rather than entering a raw string. Keep the work local: do not import, publish, deploy, run a live
flow, or change Prismatic or Salesforce state.`,
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
      threshold: 0,
      evidence,
      criteria: `Orby recognizes an existing Code Native Integration and uses the canonical
installed prismatic-build-integration skill to make the change in place. It does not treat this
as a platform-operation request or stop after recommending a skill.`,
    },
    {
      id: "implements-record-type-data-source",
      type: "rubric",
      threshold: 0,
      evidence,
      maxArtifactExcerpt: 20_000,
      criteria: `The specialist handoff produces a useful local result: the Salesforce Record Type
deployer field is changed from a raw string to a Spectral data-source configuration variable
backed by a data source using the existing Salesforce connection. The fixture defines this
field as a Salesforce object API name (for example Account or Opportunity), not a Salesforce
RecordType record or ID; preserve that existing value meaning and stable configuration identity. Judge the
handoff and successful project build; detailed specialist correctness belongs to the
prismatic-build-integration skill's evaluations.`,
    },
    {
      id: "local-only-handoff",
      type: "rubric",
      threshold: 0,
      evidence,
      criteria: `The work remains local: no Prismatic import, publication, deployment, live flow,
or Salesforce mutation is attempted or claimed. The final answer reports the local checks that
actually ran and identifies any unverified platform behavior without implying live tests are
required for this local-only request.`,
    },
  ],
  meta: {
    skill: "orby",
    tags: ["orby", "routing", "integration-skill", "train"],
  },
});
