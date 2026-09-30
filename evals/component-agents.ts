import { realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  disabledCodexSkills,
  grokIsolationEnv,
  prismIsolationState,
} from "./agent-isolation.ts";
import { prismBin } from "./prism.ts";

const nodeRoot = dirname(dirname(await realpath(process.execPath)));

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
          skills: { config: await disabledCodexSkills() },
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
        permissionMode: "proceed-in-sandbox",
        get permissions() {
          const prism = prismIsolationState();
          return {
            allow: [
              ...(prism ? [`write_file(${prism.directory})`] : []),
              ...[
                resolve(import.meta.dirname, "../skills"),
                resolve(
                  process.env.PRISM_ROOT ??
                    resolve(import.meta.dirname, "../../prism"),
                ),
                prismBin,
                nodeRoot,
              ].map((path) => `read_file(${path})`),
              // Match the other profiles' documentation/package network access.
              "read_url(*)",
            ],
          };
        },
        // Private Lux settings; credential reuse is an explicit host opt-in.
        authTokenFile: process.env.ANTIGRAVITY_AUTH_TOKEN_FILE,
        reuseKeychain: process.env.ANTIGRAVITY_REUSE_KEYCHAIN === "1",
        mode: "accept-edits",
        idleTimeout: "20 minutes",
        get env() {
          const prism = prismIsolationState();
          return {
            ...env,
            ...(prism ? { PRISM_CONFIG_FILE: prism.configFile } : {}),
          };
        },
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
// Components and CNI keep their existing default matrix.
export const componentAgentNames = ["claude-code", "codex", "grok-build"];

export const allAgentNames = [
  "claude-code",
  "codex",
  "antigravity",
  "grok-build",
];
