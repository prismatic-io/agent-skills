import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { type LuxConfig, subjectPath } from "@prismatic-io/lux";
import { evalBin, evalModules } from "./tools.ts";

export const codexDriver = {
  name: "codex",
  config: {
    model: "gpt-6.1-sol",
    reasoningEffort: "low" as const,
    addDirs: [subjectPath("")],
    skillDirs: [
      subjectPath("orby"),
      subjectPath("prismatic-components"),
      subjectPath("prismatic-integrations"),
      subjectPath("prismatic-migrate"),
      subjectPath("prismatic-embedded"),
    ],
    inheritEnv: ["PRISM_CONFIG_FILE", "PRISM_PROFILE", "PRISMATIC_URL"],
    interactionMode: "app-server",
    config: { features: { default_mode_request_user_input: true } },
    approvalPolicy: "on-request",
    approvalsReviewer: "auto_review",
    idleTimeout: "20 minutes",
    maxInterrupts: 8,
    isolation: {
      allowRead: [
        subjectPath(""),
        evalBin,
        evalModules,
        dirname(dirname(process.execPath)),
        ...[
          "/System/Library/OpenSSL/openssl.cnf",
          "/opt/homebrew/etc/openssl@3/openssl.cnf",
        ].filter(existsSync),
      ],
    },
    env: {
      PATH: `${evalBin}:${dirname(process.execPath)}:${process.env.PATH}`,
      npm_config_cache: ".npm-cache",
    },
  },
} satisfies LuxConfig["defaultDriver"];

export const claudeDriver = {
  name: "claude-code",
  config: {
    model: "claude-sonnet-5",
    reasoningEffort: "medium",
    addDirs: codexDriver.config.addDirs,
    skillDirs: codexDriver.config.skillDirs,
    inheritEnv: codexDriver.config.inheritEnv,
    interactionMode: "defer-resume",
    permissionMode: "default",
    idleTimeout: "20 minutes",
    turnTimeout: "45 minutes",
    maxInterrupts: 8,
    isolation: codexDriver.config.isolation,
    env: codexDriver.config.env,
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
  codex: {
    driver: codexDriver,
    answerer: {
      name: "persona",
      config: {
        provider: "codex",
        inheritEnv: [],
        model: codexDriver.config.model,
        reasoningEffort: codexDriver.config.reasoningEffort,
      },
    },
    harness: {
      provider: "codex",
      inheritEnv: [],
      model: codexDriver.config.model,
      reasoningEffort: codexDriver.config.reasoningEffort,
    },
  },
};

export default config;
