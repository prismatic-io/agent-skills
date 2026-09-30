import { resolve } from "node:path";
import { allAgentNames } from "./component-agents.ts";
import { runSkillEvals } from "./run-skill-evals.ts";

// The signing-key case authorizes a real sandbox key. Respect caller-supplied
// Prism policy and profile reuse while retaining the embedded isolation controls.
process.exitCode = await runSkillEvals(
  "embedded-skill",
  process.argv.slice(2),
  {},
  allAgentNames,
  resolve(import.meta.dirname, "embedded"),
);
