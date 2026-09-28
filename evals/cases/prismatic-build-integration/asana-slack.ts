import { resolve } from "node:path";
import {
  defineEvalCase,
  type RubricEvidence,
  subjectPath,
} from "@prismatic-io/lux";

const evidence = {
  artifactPatterns: [
    "*/package.json",
    "*/documentation.md",
    "*/src/**/*.ts",
    "*/.spectral/**/*.ts",
    "*/.env*",
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
  maxAgentChars: 30_000,
  maxToolChars: 60_000,
  maxArtifactChars: 80_000,
} satisfies Partial<RubricEvidence>;

export default defineEvalCase({
  id: "prismatic-build-integration/asana-slack",
  prompt: `Use the skill at ${subjectPath("prismatic-build-integration/SKILL.md")}.
Work entirely in the current directory and deliver a locally buildable Code Native Integration.
Do not mutate Prismatic or connected services.

I maintain Asana. I need to build an integration for my customers so when
they create a task in a project, a notification is sent to Slack that the task was created.
Build an integration that prompts a user who deploys the integration for their Slack and Asana
credentials, which Asana project(s) they want to watch, and which Slack channel to send the
notifications to.`,
  persona: `You are the product developer requesting the integration. You can clarify the
Asana-to-Slack behavior but have no preferences about APIs, authentication protocols, code
structure, or libraries. Asana and Slack credentials are not available in this session;
deployment and live verification are outside this request.`,
  assertions: [
    { type: "glob-count", glob: "*/package.json", min: 1, max: 1 },
    { type: "glob-count", glob: "*/src/index.ts", min: 1, max: 1 },
    {
      type: "command-exits-zero",
      command: `node ${resolve(import.meta.dirname, "../../scripts/verify-generated-cni.mjs")}`,
      inheritEnv: ["PATH"],
      timeout: "4 minutes",
    },
    {
      type: "rubric",
      name: "implements the requested configurable event-to-notification integration",
      evidence,
      maxArtifactExcerpt: 20_000,
      criteria: `The artifacts are a Prismatic Code Native Integration that connects to both
Asana and Slack without embedded credentials; exposes deploy-time configuration for Asana
credentials, Slack credentials, one or more watched Asana projects, and a Slack destination
channel; represents newly-created Asana tasks as the source event through a reasonable trigger
or polling design; and sends a useful task-created notification to the configured Slack channel.
Do not require one particular auth mechanism, component manifest, trigger style, or file layout.`,
    },
    {
      type: "rubric",
      name: "stays within the local-build boundary",
      evidence,
      maxArtifactExcerpt: 20_000,
      criteria: `The run does not mutate Prismatic, Asana, or Slack, and the generated project
contains no embedded secrets. Documentation and package access plus local installation, tests,
and builds are allowed.`,
    },
  ],
  meta: { skill: "prismatic-build-integration", tags: ["integration-skill"] },
});
