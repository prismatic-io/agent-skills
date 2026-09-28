import type { LuxConfig } from "@prismatic-io/lux";
import { additionalComponentProfiles } from "./component-agents.ts";
import { prismBin } from "./component-case.ts";

const claudeDriver: LuxConfig["defaultDriver"] = {
  name: "claude-code",
  config: {
    model: "claude-sonnet-5",
    reasoningEffort: "medium",
    permissionMode: "auto",
    interactionMode: "defer-resume",
    // Reset inactivity on progress; cap each deferred invocation separately.
    idleTimeout: "20 minutes",
    turnTimeout: "45 minutes",
    maxInterrupts: 6,
    extraArgs: ["--setting-sources", "", "--strict-mcp-config"],
    env: {
      PATH: `${prismBin}:${process.env.PATH}`,
      npm_config_cache: ".npm-cache",
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
      CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1",
    },
  },
};

const config: LuxConfig = {
  casesRoot: "./cases",
  runsRoot: "./.lux-runs",
  subjectRoot: "../skills",
  defaultDriver: additionalComponentProfiles.codex.driver,
  defaultAnswerer: {
    name: "persona",
    config: {
      provider: "claude-code",
      model: "claude-opus-5-5",
      reasoningEffort: "medium",
    },
  },
  harness: {
    provider: "claude-code",
    model: "claude-opus-5-5",
    reasoningEffort: "medium",
  },
};

config.profiles = {
  "claude-code": { driver: claudeDriver },
  ...additionalComponentProfiles,
};

export default config;
