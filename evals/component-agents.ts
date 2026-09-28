import { disabledCodexSkills, grokIsolationEnv } from "./agent-isolation.ts";
import { prismBin } from "./component-case.ts";

const env = {
  PATH: `${prismBin}:${process.env.PATH}`,
  // Keep npm writes inside each disposable cwd and out of artifact discovery.
  npm_config_cache: ".npm-cache",
};

export const additionalComponentProfiles = {
  codex: {
    driver: {
      name: "codex",
      config: {
        model: "gpt-6-sol",
        reasoningEffort: "low",
        interactionMode: "app-server",
        approvalPolicy: "on-request",
        approvalsReviewer: "auto_review",
        sandbox: "workspace-write",
        ignoreUserConfig: true,
        config: {
          sandbox_workspace_write: { network_access: true },
          project_doc_max_bytes: 0,
          skills: { config: disabledCodexSkills() },
        },
        ephemeral: true,
        idleTimeout: "20 minutes",
        maxInterrupts: 6,
        env,
      },
    },
  },
  antigravity: {
    driver: {
      name: "antigravity",
      config: {
        model: "gemini-3.1-pro",
        reasoningEffort: "low",
        skipPermissions: false,
        sandbox: true,
        mode: "accept-edits",
        idleTimeout: "20 minutes",
        env,
      },
    },
  },
  "grok-build": {
    driver: {
      name: "grok-build",
      config: {
        model: "grok-4.6",
        reasoningEffort: "low",
        permissionMode: "auto",
        sandbox: "workspace",
        trustProject: false,
        idleTimeout: "20 minutes",
        get env() {
          return { ...env, ...grokIsolationEnv() };
        },
      },
    },
  },
};
// Antigravity remains available through explicit profile selection.
export const componentAgentNames = ["claude-code", "codex", "grok-build"];
