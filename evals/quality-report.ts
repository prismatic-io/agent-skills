import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const qualityPolicy = "component-quality-ordinal-v1";
export type Dimension = "behavior" | "validation" | "usability";
type State = "pass" | "fail" | "unknown";

export interface GradeEntry {
  id: string;
  type: string;
  score?: number | null;
  passed?: boolean | null;
  comment?: string;
  abstention?: string;
  errorMessage?: string;
}

export interface Grade {
  casePassed?: boolean | null;
  caseScore?: number | null;
  assertions?: GradeEntry[];
}

export interface DimensionResult {
  rating: 0 | 1 | 2 | 3 | 4 | null;
  meanScore: number | null;
  observed: number;
  missing: number;
  evidence: Array<
    Pick<GradeEntry, "id" | "score" | "comment" | "abstention" | "errorMessage">
  >;
}

export interface QualityReport {
  policy: typeof qualityPolicy;
  assessmentKind: "saved-rubric-projection";
  inventoryVerified: false;
  source: string;
  provisional: boolean;
  dimensions: Record<Dimension, DimensionResult>;
  execution: { completion: State; componentChecks: State };
  legacy: { casePassed: boolean | null; caseScore: number | null };
  assertions: GradeEntry[] | null;
  scope: GradeEntry[];
  feedback: Array<{
    dimension: Dimension;
    criterion: string;
    score: number;
    comment: string;
  }>;
  caveat: string;
}

const anchors = ["absent", "limited", "partial", "solid", "strong"] as const;
const dimensions: Dimension[] = ["behavior", "validation", "usability"];
const dimensionOf = (id: string, type: string): Dimension | null => {
  if (type !== "rubric" || id === "local-scope") return null;
  if (id === "meaningful-tests" || id === "tests") return "validation";
  if (
    id === "nondeveloper-experience" ||
    id === "documentation-accuracy" ||
    id === "handoff"
  )
    return "usability";
  return "behavior";
};
const isObserved = (
  entry: GradeEntry,
): entry is GradeEntry & { score: number } =>
  entry.errorMessage === undefined &&
  entry.abstention === undefined &&
  typeof entry.score === "number" &&
  Number.isFinite(entry.score) &&
  entry.score >= 0 &&
  entry.score <= 1;
const hasFeedback = (
  entry: DimensionResult["evidence"][number],
): entry is DimensionResult["evidence"][number] & {
  score: number;
  comment: string;
} =>
  entry.errorMessage === undefined &&
  entry.abstention === undefined &&
  typeof entry.score === "number" &&
  Number.isFinite(entry.score) &&
  entry.score >= 0 &&
  entry.score <= 1 &&
  typeof entry.comment === "string" &&
  entry.comment.length > 0;

const stateOf = (entry: GradeEntry | undefined): State => {
  if (!entry || entry.errorMessage || entry.abstention) return "unknown";
  if (entry.passed === true) return "pass";
  if (entry.passed === false) return "fail";
  return "unknown";
};

export const reportQuality = (
  grade: Grade | null,
  source = "grading.json",
): QualityReport => {
  const entries = grade?.assertions ?? [];
  const result = Object.fromEntries(
    dimensions.map((dimension) => {
      const relevant = entries.filter(
        (entry) => dimensionOf(entry.id, entry.type) === dimension,
      );
      const observed = relevant.filter(isObserved);
      const meanScore = observed.length
        ? observed.reduce((sum, entry) => sum + entry.score, 0) /
          observed.length
        : null;
      const rating =
        meanScore === null
          ? null
          : (Math.round(meanScore * 4) as 0 | 1 | 2 | 3 | 4);
      return [
        dimension,
        {
          rating,
          meanScore,
          observed: observed.length,
          missing: relevant.length - observed.length,
          evidence: relevant.map(
            ({ id, score, comment, abstention, errorMessage }) => ({
              id,
              score,
              comment,
              abstention,
              errorMessage,
            }),
          ),
        },
      ];
    }),
  ) as Record<Dimension, DimensionResult>;
  const ranked = dimensions
    .flatMap((dimension) =>
      result[dimension].evidence.filter(hasFeedback).map((entry) => ({
        dimension,
        criterion: entry.id,
        score: entry.score,
        comment: entry.comment,
      })),
    )
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);
  const execution = {
    completion: stateOf(entries.find((entry) => entry.id === "completed")),
    componentChecks: stateOf(
      entries.find(
        (entry) =>
          entry.id === "component-checks" || entry.id === "local-checks",
      ),
    ),
  };
  return {
    policy: qualityPolicy,
    assessmentKind: "saved-rubric-projection",
    inventoryVerified: false,
    source,
    provisional:
      !grade ||
      execution.completion === "unknown" ||
      execution.componentChecks === "unknown" ||
      dimensions.some(
        (dimension) =>
          result[dimension].rating === null || result[dimension].missing > 0,
      ),
    dimensions: result,
    execution,
    legacy: {
      casePassed: grade?.casePassed ?? null,
      caseScore: grade?.caseScore ?? null,
    },
    assertions: grade?.assertions ?? null,
    scope: entries.filter(
      (entry) => entry.type === "rubric" && entry.id === "local-scope",
    ),
    feedback: ranked,
    caveat:
      "Ordinal ratings are estimates mapped from saved Lux scores, not a qualitative regrade. Expected assertion inventory is not verified. Older judges were calibrated for pass/fail. Inspect source and independent probes before treating small differences as meaningful; independent probes do not add authored validation coverage.",
  };
};

export const rankByDimension = (
  reports: QualityReport[],
  dimension: Dimension,
): QualityReport[] => {
  return [...reports].sort((a, b) => {
    const av = a.dimensions[dimension].rating;
    const bv = b.dimensions[dimension].rating;
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    return bv - av;
  });
};

export const readQuality = async (path: string): Promise<QualityReport> => {
  const input = resolve(path);
  const file = input.endsWith(".json") ? input : join(input, "grading.json");
  try {
    return reportQuality(
      JSON.parse(await readFile(file, "utf8")) as Grade,
      file,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return reportQuality(null, file);
    throw error;
  }
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const paths = args.filter((arg) => arg !== "--json");
  if (!paths.length)
    throw new Error(
      "Usage: node evals/quality-report.ts <grading.json|run-directory>... [--json]",
    );
  const reports = await Promise.all(paths.map(readQuality));
  if (json)
    console.log(
      JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2),
    );
  else
    for (const report of reports) {
      console.log(`Saved rubric score estimates: ${report.source}`);
      for (const dimension of dimensions) {
        const value = report.dimensions[dimension];
        console.log(
          `  ${dimension}: ${value.rating === null ? "unassessed" : `${value.meanScore?.toFixed(2)} (anchor ${value.rating}/4 ${anchors[value.rating]})`} (${value.observed} observed, ${value.missing} missing)`,
        );
      }
      console.log(
        `  execution: completion=${report.execution.completion}, component-checks=${report.execution.componentChecks}`,
      );
      for (const scope of report.scope)
        console.log(
          `  local scope: ${isObserved(scope) ? scope.score.toFixed(2) : "unassessed"}; ${scope.comment ?? scope.errorMessage ?? scope.abstention ?? "no feedback"}`,
        );
      for (const item of report.feedback)
        console.log(
          `  feedback (${item.dimension}/${item.criterion}, ${item.score.toFixed(2)}): ${item.comment}`,
        );
      console.log(`  caveat: ${report.caveat}`);
      if (report.provisional)
        console.log("  provisional: evidence is incomplete");
    }
}
