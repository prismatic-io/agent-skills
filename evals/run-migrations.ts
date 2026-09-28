import { runSkillEvals } from "./run-skill-evals.ts";

process.exitCode = await runSkillEvals("migration");
