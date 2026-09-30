import { installPrismStandin } from "./cases/prismatic-embedded/_prism-standin-install.ts";
import { runSkillEvals } from "./run-skill-evals.ts";

// Subjects get a stand-in prism that simulates signing-key commands, so no run
// registers a real key. Other Prism commands still reach the linked build.
process.exitCode = await runSkillEvals(
  "embedded-skill",
  process.argv.slice(2),
  { PRISM_READ_ONLY: "true", EVAL_PRISM_BIN: await installPrismStandin() },
);
