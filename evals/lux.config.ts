import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  defineLifecycleHooks,
  exec,
  type LuxConfig,
  subjectPath,
} from "@prismatic-io/lux";
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
  lifecycleFixtures: [
    defineLifecycleHooks({
      name: "existing-development-session",
      pluginVersion: "1",
      identity: { prism: resolve(evalBin, "prism") },
      setupSuite: async ({ abortSignal }) => {
        const result = await exec(
          process.execPath,
          [resolve(evalBin, "prism"), "me", "--format", "json"],
          { timeoutMs: 60_000, maxBuffer: 64_000, signal: abortSignal },
        );
        if (result.exitCode !== 0 || result.timedOut)
          throw new Error(
            "Cannot verify the existing Prism session with prism me.",
          );
        const session = JSON.parse(result.stdout);
        const endpoint = new URL(session.endpointUrl);
        if (
          endpoint.protocol !== "https:" ||
          !(
            endpoint.hostname === "prismatic-dev.io" ||
            endpoint.hostname.endsWith(".prismatic-dev.io")
          )
        )
          throw new Error(
            `Eval platform work requires a prismatic-dev.io session; current endpoint: ${endpoint.origin}`,
          );
        console.log(
          `Using existing Prism session: ${endpoint.origin}, organization ${session.organization.name}`,
        );
        return undefined;
      },
    }),
  ],
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
