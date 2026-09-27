import { runSkillEvals } from "./run-skill-evals.ts";

process.exitCode = await runSkillEvals(
  "integration-skill",
  process.argv.slice(2),
  { PRISM_READ_ONLY: "true" },
);
