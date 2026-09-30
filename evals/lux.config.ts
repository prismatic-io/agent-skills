import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { type LuxConfig, subjectPath } from "@prismatic-io/lux";
import { prismBin, prismRoot } from "./prism.ts";

export const codexDriver = {
  name: "codex",
  config: {
    model: "gpt-6.1-sol",
    reasoningEffort: "low",
    inheritEnv: [
      "PRISM_ROOT",
      "PRISM_CONFIG_FILE",
      "PRISM_PROFILE",
      "PRISMATIC_URL",
    ],
    interactionMode: "app-server",
    config: { features: { default_mode_request_user_input: true } },
    approvalPolicy: "on-request",
    approvalsReviewer: "auto_review",
    idleTimeout: "20 minutes",
    maxInterrupts: 6,
    isolation: {
      allowRead: [
        subjectPath(""),
        prismBin,
        prismRoot,
        dirname(dirname(process.execPath)),
        ...[
          "/System/Library/OpenSSL/openssl.cnf",
          "/opt/homebrew/etc/openssl@3/openssl.cnf",
        ].filter(existsSync),
      ],
    },
    env: {
      PATH: `${prismBin}:${dirname(process.execPath)}:${process.env.PATH}`,
      npm_config_cache: ".npm-cache",
      PRISM_READ_ONLY: "true",
    },
  },
} satisfies LuxConfig["defaultDriver"];

export const claudeDriver = {
  name: "claude-code",
  config: {
    model: "claude-sonnet-5",
    reasoningEffort: "medium",
    inheritEnv: codexDriver.config.inheritEnv,
    interactionMode: "defer-resume",
    permissionMode: "default",
    idleTimeout: "20 minutes",
    turnTimeout: "45 minutes",
    maxInterrupts: 6,
    isolation: codexDriver.config.isolation,
    env: {
      ...codexDriver.config.env,
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
      CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1",
    },
  },
} satisfies LuxConfig["defaultDriver"];

const config: LuxConfig = {
  casesRoot: "./cases",
  runsRoot: "./.lux-runs",
  subjectRoot: "../skills",
  defaultDriver: claudeDriver,
  defaultAnswerer: {
    name: "persona",
    config: {
      provider: "claude-code",
      inheritEnv: [],
      model: "claude-opus-5-5",
      reasoningEffort: "medium",
    },
  },
  harness: {
    provider: "claude-code",
    inheritEnv: [],
    model: "claude-opus-5-5",
    reasoningEffort: "medium",
  },
};

config.profiles = {
  "claude-code": { driver: claudeDriver },
  "claude-code-sandbox": {
    driver: {
      ...claudeDriver,
      config: {
        ...claudeDriver.config,
        env: { ...claudeDriver.config.env, PRISM_READ_ONLY: "false" },
      },
    },
  },
  codex: { driver: codexDriver },
  "codex-sandbox": {
    driver: {
      ...codexDriver,
      config: {
        ...codexDriver.config,
        env: { ...codexDriver.config.env, PRISM_READ_ONLY: "false" },
      },
    },
  },
};

export default config;
