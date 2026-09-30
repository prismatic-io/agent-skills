import {
  defineEvalCase,
  type RubricEvidence,
  subjectPath,
} from "@prismatic-io/lux";
import { localProjectEnvironment } from "./_environment.ts";

const evidence = {
  artifactPatterns: [
    "package.json",
    "**/package.json",
    "src/**/*",
    "**/src/**/*",
    "README.md",
    "**/README.md",
  ],
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
  maxEvents: 200,
  maxAgentChars: 35_000,
  maxToolChars: 60_000,
  maxArtifactChars: 60_000,
} satisfies Partial<RubricEvidence>;

export default defineEvalCase({
  id: "orby/bootstrap-new-org",
  prompt: `Use the coordinating skill at ${subjectPath("orby/SKILL.md")}.
${localProjectEnvironment}

I want to get started with my new Prismatic org.
- Add john@acme.com and jane@acme.com as admins for my organization.
- Add an Acme component that can listen to our webhooks.
- Add a component that can send messages to Slack.
- Build an integration that receives the Acme webhooks and sends a message to Slack.

Prepare the component and integration locally, but do not change my Prismatic organization yet.
Tell me what organization setup remains.`,
  assertions: [
    { id: "completed", type: "run-succeeded" },
    {
      id: "routes-each-specialized-stage",
      type: "rubric",
      threshold: 0,
      evidence,
      maxArtifactExcerpt: 20_000,
      criteria: `Orby decomposes the request and uses the canonical installed
prismatic-components skill for the Acme webhook connector and the canonical installed
prismatic-build-integration skill for the Acme-to-Slack integration. Each specialist is selected
from its description before its implementation stage. A successful named invocation is ideal;
when the harness cannot invoke an additional-directory skill by name, reading and applying that
canonical skill file is equivalent evidence. The result includes local component and integration implementation; valid monorepo or other
project layouts are acceptable. Merely recommending skills or writing a plan is insufficient.`,
    },
    {
      id: "useful-local-artifacts",
      type: "rubric",
      threshold: 0,
      evidence,
      maxArtifactExcerpt: 20_000,
      criteria: `The local artifacts make credible progress toward the request: the Acme
component exposes an inbound webhook trigger, and the integration consumes the Acme event and
uses Prismatic's existing Slack component or otherwise clearly models a Slack message action.
Grade orchestration and the handoff between the two projects, not production completeness or one
specific Spectral API shape. The request provides no Acme webhook schema or authentication
contract: accept clearly bounded assumptions or scaffolded unknowns without inventing production
readiness. Reusing the existing Slack component is a valid way to fulfill the Slack stage.`,
    },
    {
      id: "honest-platform-handoff",
      type: "rubric",
      threshold: 0,
      evidence,
      criteria: `The trace contains no organization mutation, component publication, integration
import, deployment, activation, or live-service test. The final answer does not claim those
happened and accurately distinguishes the completed local work from the platform setup and secure
configuration that remain.`,
    },
  ],
  meta: {
    skill: "orby",
    tags: ["orby", "coordination", "bootstrap", "train"],
  },
});
