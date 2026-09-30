import { mkdir, mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { componentAgentNames } from "./component-agents.ts";
import { launchLux } from "./launch-environment.ts";
import {
  classifySuiteOutcome,
  formatSuiteQuality,
  readSuiteQuality,
} from "./quality-suite-report.ts";

export const runSkillEvals = async (
  tag: string,
  args: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = {},
  profiles: readonly string[] = componentAgentNames,
  cwd = import.meta.dirname,
) => {
  const listOnly = args.some((arg) =>
    ["--list", "--list-tags", "--help", "-h"].includes(arg),
  );
  let baseRoot = resolve(import.meta.dirname, ".lux-runs/quality-runs");
  const forwarded: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (value === "--profile" || value.startsWith("--profile=")) {
      throw new Error(
        "eval:run owns the profile matrix; use node run-lux.ts run to select one profile",
      );
    }
    if (value === "--runs-root") {
      if (!args[index + 1] || args[index + 1].startsWith("-"))
        throw new Error("--runs-root needs a directory");
      baseRoot = resolve(args[++index]);
    } else if (value.startsWith("--runs-root=")) {
      const path = value.slice("--runs-root=".length);
      if (!path) throw new Error("--runs-root needs a directory");
      baseRoot = resolve(path);
    } else {
      forwarded.push(value);
    }
  }

  // A listing does not create any run or quality report.
  if (!listOnly) await mkdir(baseRoot, { recursive: true });
  const invocationRoot = listOnly
    ? null
    : await mkdtemp(join(baseRoot, "eval-run-"));
  let failed = false;
  const summaries: string[] = [];
  for (const profile of profiles) {
    const profileRoot = invocationRoot ? join(invocationRoot, profile) : null;
    if (profileRoot) await mkdir(profileRoot);
    const result = await launchLux(
      [
        "run",
        "--tag",
        tag,
        "--profile",
        profile,
        ...forwarded,
        ...(profileRoot ? ["--runs-root", profileRoot] : []),
      ],
      { ...process.env, ...env },
      cwd,
    );
    if (result.error) console.error(result.error.message);
    if (result.error || result.signal) failed = true;
    if (profileRoot) {
      try {
        const suite = await readSuiteQuality(profileRoot);
        summaries.push(formatSuiteQuality(suite, profile));
        const outcome = classifySuiteOutcome(
          suite,
          result.status,
          result.signal,
        );
        if (outcome === "execution-or-check-failure") failed = true;
        else if (outcome === "grading-incomplete") {
          failed = true;
          summaries.push(
            `${profile}: execution and saved checks completed; grading has missing or invalid evidence. Unassessed criteria are not demonstrated skill failures`,
          );
        } else if (outcome === "rubric-only")
          summaries.push(
            `${profile}: Lux's legacy rubric pass gate failed; quality ratings above are the primary result`,
          );
      } catch (error) {
        failed = true;
        summaries.push(
          `${profile}: quality report unavailable: ${String(error)}`,
        );
      }
    } else if (result.status !== 0) {
      failed = true;
    }
    if (result.signal) {
      summaries.push(
        `${profile}: Lux terminated by ${result.signal}; remaining profiles were not launched`,
      );
      break;
    }
  }
  if (summaries.length) console.log(`\n${summaries.join("\n\n")}`);
  return failed ? 1 : 0;
};
