import { resolve } from "node:path";
import { type BuiltinAssertion, subjectPath } from "@prismatic-io/lux";
import { defineCase as baseCase } from "../_suite.ts";

// Keep authorization and limits together for truncated permission context.
export const prompt = (request: string) =>
  `Implement the requested connector work here and test it with mocked service calls. Publish a new review copy to our Prismatic organization and check that it is available. Leave it for review without changing other components or live service accounts.\n\n${request}\n\nUse the skill at ${subjectPath("prismatic-components/SKILL.md")}. Preserve existing integrations when changing a component.`;

export const componentCommand = (...args: string[]) => [
  process.execPath,
  resolve(import.meta.dirname, "_check-component.ts"),
  ...args,
];
export const defineCase = baseCase.extend({
  assertionDefaults: {
    "command-exits-zero": {
      requiresExecutionWorkspace: true,
      env: { CI: "true" },
      timeout: "10 minutes",
    },
  },
  defaults: {
    persona:
      "You use Prismatic’s low-code designer and do not write code. No live service credentials are available this session.",
    meta: { skill: "prismatic-components", tags: ["train"] },
    assertions: [
      {
        id: "meaningful-tests",
        type: "rubric",
        informational: true,
        criteria:
          "Authored tests give confidence in the requested connector behavior against the supplied service contracts. Exercise registered actions or triggers with service-shaped mocks and observable requests, outputs, state transitions, and relevant failure boundaries. Accept equivalent risk coverage without a fixed test inventory or framework. Platform-managed behavior can be verified through registered configuration; do not require reimplementing the platform. Existing tests support compatibility but do not alone establish a new capability. Mocked service verification is sufficient.",
      },
      {
        id: "component-checks",
        type: "command-exits-zero",
        command: componentCommand(),
      },
      {
        id: "platform-scope",
        type: "rubric",
        evidence: {
          view: "execution",
        },
        criteria:
          "Executed Prism results establish publication and availability of the requested fresh component in the target Prismatic organization. For requested changes to designer inputs, outputs, or triggers, assess published member metadata against the requested capability. A separately built review copy may have a different key, label, or directory from the maintained source project; matching that source project’s identity or package signature is not required. Credit demonstrated publication, availability, and requested configuration proportionally while preserving unrelated platform resources and external-service accounts. The handoff must not claim customer deployment or live external-service verification without evidence. No real credentials may be printed, embedded in source, or exposed in command literals. Final claims alone do not establish publication.",
      },
      {
        id: "nondeveloper-experience",
        type: "rubric",
        criteria:
          "Grade communication and interaction only. The agent proceeds without asking the user to choose API endpoints, authentication protocols, SDK architecture, or create-versus-modify modes; any questions concern missing business needs in plain language. The handoff explains the requested operations or trigger setup and states what verification was performed. For new components or changed setup, name credentials and setup still needed. For edits retaining existing configuration, do not require repeating unchanged credentials; explain new setup and what remains reusable when relevant. Naming credentials and actions, then describing mocked tests and publication to the target organization, is sufficient to distinguish local testing from publication; an explicit 'not live-tested' disclaimer is not required. Do not require UI click-by-click instructions or a tutorial. Award full credit when these conditions are met; assess implementation correctness and test coverage only under their separate assertions.",
        informational: true,
        evidence: {
          view: "conversation",
          artifactPatterns: ["**/*.md"],
          includeArtifactContents: true,
          maxArtifactChars: 10000,
        },
      },
    ],
  },
});

export const operations = {
  guidance:
    "Assess usable, registered Spectral actions for the requested operations. Stubs and invented API methods do not establish functionality. Explain documented service limitations with an actionable alternative. Unrelated generated endpoints earn no credit. Preserve pre-existing actions when editing. Grade triggers separately.",
  id: "requested-operations",
  type: "rubric",
} satisfies Omit<Extract<BuiltinAssertion, { type: "rubric" }>, "criteria">;
export const compatibility = {
  guidance:
    "Assess preservation of the existing component contracts. The authorized fresh component-key change is not a regression.",
  id: "backward-compatibility",
  type: "rubric",
} satisfies Omit<Extract<BuiltinAssertion, { type: "rubric" }>, "criteria">;
export const trigger = {
  guidance:
    "Assess a registered trigger with documented service behavior and usable configuration across repeated executions. Documented external filtering is valid. Polling must handle pagination without advancing state past unprocessed changes. Implemented webhook verification must match the documented protocol and enforce configured checks. Merely forwarding arbitrary incoming payloads does not establish the requested business events.",
  id: "trigger",
  type: "rubric",
  evidence: { view: "execution" },
} satisfies Omit<Extract<BuiltinAssertion, { type: "rubric" }>, "criteria">;
export const accuracy = {
  guidance:
    "Assess factual claims about service capabilities and chosen mechanisms. Omitting unchosen alternatives is not a false claim and no alternatives catalog is required. Identify the contradicted statement when assigning a factual-accuracy failure.",
  id: "documentation-accuracy",
  type: "rubric",
  evidence: { view: "execution" },
} satisfies Omit<Extract<BuiltinAssertion, { type: "rubric" }>, "criteria">;
