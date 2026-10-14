import { existsSync } from "node:fs";
import { delimiter, dirname } from "node:path";
import { type LuxConfig, subjectPath } from "@prismatic-io/lux";
import { evalBin, evalModules } from "./tools.ts";

export const codexDriver = {
  name: "codex",
  config: {
    model: "gpt-6.1-sol",
    reasoningEffort: "low" as const,
    config: { features: { default_mode_request_user_input: true } },
    approvalsReviewer: "auto_review",
  },
} satisfies LuxConfig["defaultDriver"];

export const claudeDriver = {
  name: "claude-code",
  config: {
    model: "claude-sonnet-5",
    reasoningEffort: "medium",
    permissionMode: "default",
    turnTimeout: "45 minutes",
  },
} satisfies LuxConfig["defaultDriver"];

const config: LuxConfig = {
  casesRoot: "./cases",
  subjectRoot: "../skills",
  driverDefaults: {
    addDirs: [subjectPath("")],
    skillDirs: [
      subjectPath("orby"),
      subjectPath("prismatic-components"),
      subjectPath("prismatic-integrations"),
      subjectPath("prismatic-migrate"),
      subjectPath("prismatic-embedded"),
    ],
    inheritEnv: ["PRISM_CONFIG_FILE", "PRISM_PROFILE", "PRISMATIC_URL"],
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
      PATH: [evalBin, dirname(process.execPath), process.env.PATH].join(
        delimiter,
      ),
      npm_config_cache: ".npm-cache",
    },
    idleTimeout: "20 minutes",
    maxInterrupts: 8,
  },
  defaultDriver: claudeDriver,
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
    harness: {
      provider: "codex",
      inheritEnv: [],
      model: codexDriver.config.model,
      reasoningEffort: codexDriver.config.reasoningEffort,
    },
  },
};

export default config;
