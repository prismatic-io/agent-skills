import type { LuxConfig } from "@prismatic-io/lux";
import { prismBin } from "./component-case.ts";

const config: LuxConfig = {
  casesRoot: "./cases",
  runsRoot: "./.lux-runs",
  subjectRoot: "../skills",
  defaultDriver: {
    name: "claude-code",
    config: {
      model: "claude-sonnet-5",
      reasoningEffort: "medium",
      interactionMode: "defer-resume",
      idleTimeoutMs: 1_200_000,
      maxInterrupts: 6,
      allowedTools: ["WebSearch", "WebFetch"],
      extraArgs: ["--setting-sources", "", "--strict-mcp-config"],
      env: {
        PATH: `${prismBin}:${process.env.PATH}`,
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
        CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1",
      },
    },
  },
  defaultAnswerer: {
    name: "persona",
    config: {
      provider: "claude-code",
      model: "claude-haiku-4-5",
      reasoningEffort: "low",
    },
  },
  harness: {
    provider: "claude-code",
    model: "claude-sonnet-5",
    reasoningEffort: "medium",
  },
};

export default config;
