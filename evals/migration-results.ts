import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type GradingReport, GradingReportSchema } from "@prismatic-io/lux";

type Dimension =
  | "execution"
  | "build"
  | "project-checks"
  | "behavior"
  | "verification"
  | "handoff"
  | "scope";
const dimension = (id: string): Dimension => {
  switch (id) {
    case "completed":
      return "execution";
    case "local-build":
      return "build";
    case "project-checks":
      return "project-checks";
    case "behavioral-verification":
      return "verification";
    case "honest-handoff":
      return "handoff";
    case "local-boundary":
      return "scope";
    default:
      return "behavior";
  }
};

// Preserve assertion verdicts. This is a reading aid, not another model judge or
// a readiness score. A rubric pass is not an independently proved behavior.
export const summarizeMigration = (report: GradingReport) => {
  const groups = Object.fromEntries(
    (
      [
        "execution",
        "build",
        "project-checks",
        "behavior",
        "verification",
        "handoff",
        "scope",
      ] as const
    ).map((key) => [
      key,
      [] as {
        id: string;
        outcome: string;
        method: string;
        evidence?: string;
        errorMessage?: string;
        abstention?: string;
      }[],
    ]),
  );
  for (const entry of report.assertions) {
    const id = entry.id ?? entry.name;
    groups[dimension(id)].push({
      id,
      outcome: entry.errorMessage
        ? "grading-error"
        : entry.abstention
          ? "unknown"
          : entry.passed
            ? "pass"
            : "fail",
      method: entry.type,
      ...(entry.comment ? { evidence: entry.comment } : {}),
      ...(entry.errorMessage ? { errorMessage: entry.errorMessage } : {}),
      ...(entry.abstention ? { abstention: entry.abstention } : {}),
    });
  }
  for (const entry of report.skippedAssertions ?? []) {
    groups[dimension(entry.id)].push({
      id: entry.id,
      outcome: "not-graded",
      method: entry.type,
      evidence: entry.reason,
    });
  }
  return {
    reviewRequired: report.assertions.some((entry) => entry.type === "rubric"),
    complete:
      !report.incomplete &&
      report.casePassed !== null &&
      !report.skippedAssertions?.length &&
      !report.assertions.some(
        (entry) => entry.errorMessage || entry.abstention,
      ),
    casePassed: report.casePassed,
    ...(report.incomplete ? { incomplete: report.incomplete } : {}),
    dimensions: groups,
  };
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.length < 3)
    throw new Error("Usage: node migration-results.ts <grading.json> [...]");
  for (const file of process.argv.slice(2)) {
    const saved = JSON.parse(await readFile(file, "utf8"));
    const report = GradingReportSchema.parse(saved.report ?? saved);
    console.log(
      JSON.stringify({ file, ...summarizeMigration(report) }, null, 2),
    );
  }
}
