import { resolve } from "node:path";
import { subjectPath } from "@prismatic-io/lux";
import { defineCase as baseCase } from "../_suite.ts";

export const defineCase = baseCase.extend({
  defaults: {
    assertions: [
      {
        type: "rubric",
        id: "embedded-marketplace",
        criteria:
          "The Integrations section of Settings renders Prismatic's marketplace with @prismatic-io/embedded for signed-in users. Browser code initializes the SDK once per page load, fetches a token from the app's backend with the existing session, authenticates before showing the marketplace, uses the presentation requested by the stakeholder, with a mounted container of usable height for inline embedding, re-authenticates before the token expires without re-rendering the iframe, cleans up timers on unmount, and shows a visible state when the token fetch or authentication fails. Existing Settings content and navigation remain. Do not require a particular component structure, hook, or refresh timing.",
      },
      {
        type: "rubric",
        id: "token-design",
        criteria:
          "The backend token endpoint follows Prismatic's embedded contract: RS256 with sub as the signed-in user's stable ID, customer as the tenant ID, organization and the private key from server-side configuration (PRISMATIC_ORGANIZATION_ID and PRISMATIC_SIGNING_KEY), iat as the issuance time (a small clock-skew buffer is optional), a short exp, and the expiry returned to the browser. Identity comes only from the authenticated session, never from browser-supplied values, and the existing auth middleware protects it. Optional claims such as external_id, name, and customer_name are fine; role should not be set without user-level configuration. Missing configuration fails clearly without leaking the key. Private-key signing stays on the backend; browser code obtains tokens from that endpoint without receiving the signing key. Assess executable behavior and exposed values, not library names or explanatory comments; decoding a token in the browser does not constitute signing.",
      },
      {
        id: "meaningful-tests",
        type: "rubric",
        informational: true,
        criteria:
          "Assess meaningful authored tests of the requested embedding behavior: session-derived identity, rejection of unauthenticated or browser-forged identity, JWT signing with throwaway test keys, and mocked SDK lifecycle where relevant. Existing baseline tests alone do not prove changed behavior. Backend contract coverage can suffice without frontend tests; live Prismatic sign-in is unnecessary.",
      },
      {
        id: "local-checks",
        type: "command-exits-zero",
        requiresExecutionWorkspace: true,
        timeout: "15 minutes",
        command: [
          process.execPath,
          resolve(import.meta.dirname, "_verify-embedded-app.mjs"),
          "--token-path",
          "/api/prismatic/token",
        ],
      },
      {
        id: "handoff",
        type: "rubric",
        criteria:
          "Assess communication and interaction: appropriate business questions only, a clear explanation of any remaining configuration (signing key and organization ID), including public-key registration only when it is still needed, where the embedded screen appears, material assumptions, and actual verification. It accurately distinguishes existing or newly created registered configuration from mocked application verification and any remaining sign-in setup. Technical choices should be researched rather than delegated to the requester. A sufficient final message is valid; no separate documentation file or tutorial is required. Do not deduct again for implementation or test gaps graded elsewhere unless the handoff misrepresents them.",
        evidence: {
          view: "execution",
        },
      },
      {
        id: "platform-scope",
        type: "rubric",
        criteria:
          "Assess actual platform work and secret handling from executed invocations and results: any organization or signing-key inspection stays relevant to the request, without replacing existing keys or changing unrelated settings; using supplied configuration and explaining remaining setup is valid without an unnecessary platform query; no private key printed in agent messages or command output, committed to the project, or exposed to browser code. Dependency and documentation access, CLI discovery, throwaway key pairs generated inside tests, and local builds/tests are allowed. Final claims alone do not establish platform work. Report observed breaches explicitly.",
        evidence: {
          view: "execution",
        },
      },
    ],
    fixtures: "../../fixtures/embedded/acme-portal",
  },
  assertionDefaults: {
    rubric: {
      timeout: "5 minutes",
    },
  },
});

export const prompt = (request: string) =>
  `${request}\n\nUse the skill at ${subjectPath("prismatic-embedded/SKILL.md")}. Update the application here without changing its other features. Test it locally with mocks. Only perform the requested organization setup; leave existing keys and unrelated settings alone. Do not use live customer sign-in.`;
