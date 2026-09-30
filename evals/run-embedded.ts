import { mkdir, mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { installPrismStandin } from "./cases/prismatic-embedded/_prism-standin-install.ts";
import { allAgentNames } from "./component-agents.ts";
import { runSkillEvals } from "./run-skill-evals.ts";

const cache = resolve(import.meta.dirname, ".lux-cache");
await mkdir(cache, { recursive: true });
// Separate invocation logs prevent concurrent runners from sharing key evidence.
const root = await mkdtemp(join(cache, "embedded-standin-"));
const args = process.argv.slice(2);
if (
  !args.some(
    (arg) =>
      arg === "--concurrency" ||
      arg === "-j" ||
      arg.startsWith("--concurrency="),
  )
) {
  args.push("--concurrency", "1");
}
process.exitCode = await runSkillEvals(
  "embedded-skill",
  args,
  {
    PRISM_READ_ONLY: "true",
    PRISM_REUSE_PROFILE: "0",
    EVAL_PRISM_BIN: await installPrismStandin({ root, localOnly: true }),
  },
  allAgentNames,
  resolve(import.meta.dirname, "embedded"),
);
