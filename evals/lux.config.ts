import { resolve } from "node:path";
import type { LuxConfig } from "@prismatic-io/lux";
import { fixtureHashes } from "./cases/prismatic-migrate-integration/_migration-inputs.ts";
import { createMigrationRubric } from "./cases/prismatic-migrate-integration/_migration-rubric.ts";
import { additionalComponentProfiles } from "./component-agents.ts";
import { prismBin } from "./prism.ts";

export const claudeDriver = {
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
} satisfies LuxConfig["defaultDriver"];

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

config.assertions = [
  createMigrationRubric(config.harness, (run) => {
    const fixture = run.case.fixtures;
    return typeof fixture === "object" && fixture.kind === "dir"
      ? fixtureHashes.get(resolve(fixture.path))
      : undefined;
  }),
];

export default config;
