import { resolve } from "node:path";
import base, { claudeDriver } from "../lux.config.ts";
import { prismBin } from "../prism.ts";

const {
  extraArgs: _extraArgs,
  turnTimeout: _turnTimeout,
  ...config
} = claudeDriver.config;
const driver = {
  ...claudeDriver,
  config: {
    ...config,
    permissionMode: "default",
    interactionMode: "stream-json",
    isolation: {
      allowRead: [resolve(import.meta.dirname, "../../skills"), prismBin],
    },
    // Native Edit/Write bypass the Bash filesystem sandbox. Keep edits in Bash;
    // isolation also disables hooks, MCP, and unsandboxed command fallback.
    extraArgs: [
      "--tools",
      "Bash,Read,Glob,Grep,WebFetch,WebSearch,AskUserQuestion,Skill",
    ],
  },
};

export default {
  ...base,
  casesRoot: resolve(import.meta.dirname, "../cases"),
  subjectRoot: resolve(import.meta.dirname, "../../skills"),
  runsRoot: resolve(import.meta.dirname, "../.lux-runs"),
  profiles: { ...base.profiles, "claude-code": { driver } },
};
