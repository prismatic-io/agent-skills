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
  id: "prismatic-build-integration/salesforce-leads",
  prompt: `Use the skill at ${subjectPath("prismatic-build-integration/SKILL.md")}.
Work entirely in the current directory and deliver a locally buildable Code Native Integration.
Do not mutate Prismatic or connected services.

My customers use Salesforce. I need an integration that syncs Salesforce
leads to my app. In addition to syncing Leads as they're created, I'll need to sync existing leads
to my app (there may be thousands or millions). Also, my customers may not store Leads in standard
Leads record type, and may have custom fields associated with their Lead or custom record type.
I'll need a field mapper that maps SFDC fields to my app.`,
  persona: `You are the product developer requesting the integration. You can clarify the
Salesforce-to-application behavior but have no preferences about APIs, authentication protocols,
code structure, or libraries. Salesforce and application credentials are not available in this
session; deployment and live verification are outside this request.`,
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
      name: "implements configurable Salesforce-to-application synchronization",
      evidence,
      maxArtifactExcerpt: 20_000,
      criteria: `The artifacts are a Prismatic Code Native Integration with authenticated
boundaries for Salesforce and the destination application; deploy-time selection or discovery of
the Salesforce object/record shape; a configurable field mapping used by the sync; and behavior
for both existing records and newly-created or newly-observed records. Do not require a particular
auth mechanism, API client, trigger style, or mapping UI.`,
    },
    {
      type: "rubric",
      name: "uses a bounded and resumable high-volume design",
      evidence,
      maxArtifactExcerpt: 20_000,
      criteria: `The implementation can process thousands or millions of existing records without
loading the full dataset into one execution: it uses pagination plus bounded work, batching,
streaming, checkpoints, or an equivalently credible mechanism. Incremental work has a cursor,
watermark, event, or other resumable boundary, and the implementation addresses duplicate or
retry behavior. Credit runtime guarantees only when supported by code and the selected API or
component contract. Public generated-manifest documentation is valid contract evidence; prose
written only in the generated project's documentation is not. Do not require custom cursor code
when a selected component contract owns bounded checkpointing. Multiple sound architectures can
pass.`,
    },
    {
      type: "rubric",
      name: "stays within the local-build boundary",
      evidence,
      maxArtifactExcerpt: 20_000,
      criteria: `The run does not mutate Prismatic, Salesforce, or the destination application,
and the generated project contains no embedded secrets. Documentation and package access plus
local installation, tests, and builds are allowed.`,
    },
  ],
  meta: { skill: "prismatic-build-integration", tags: ["integration-skill"] },
});
