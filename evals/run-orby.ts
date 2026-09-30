import { allAgentNames } from "./component-agents.ts";
import { runSkillEvals } from "./run-skill-evals.ts";

process.exitCode = await runSkillEvals(
  "orby",
  process.argv.slice(2),
  { PRISM_READ_ONLY: "true" },
  allAgentNames,
);
