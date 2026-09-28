import { readdir, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  type QualityReport,
  readQuality,
  reportQuality,
} from "./quality-report.ts";

interface SuiteItem {
  caseId: string;
  status: string;
  runDir: string | null;
  exitReason?: string;
}

interface SuiteManifest {
  suiteId: string;
  profileId?: string;
  status: string;
  items: SuiteItem[];
}

export interface SuiteQualityItem {
  caseId: string;
  status: string;
  exitReason?: string;
  runDir: string | null;
  quality: QualityReport;
}

export interface SuiteQualityReport {
  suiteDir: string;
  suiteId: string;
  profileId?: string;
  status: string;
  items: SuiteQualityItem[];
}

export type SuiteOutcome =
  | "success"
  | "rubric-only"
  | "execution-or-check-failure";

/** Classify the saved assertions, never a guessed subset of check IDs. */
export const classifySuiteOutcome = (
  suite: SuiteQualityReport | null,
  exitCode: number | null,
  signal: string | null,
): SuiteOutcome => {
  if (
    signal ||
    !suite ||
    !suite.items.length ||
    (exitCode !== 0 && exitCode !== 1)
  )
    return "execution-or-check-failure";
  let rubricFailed = false;
  for (const item of suite.items) {
    if (item.status !== "completed" || item.exitReason !== "done")
      return "execution-or-check-failure";
    const assertions = item.quality.assertions;
    if (!assertions?.length || item.quality.legacy.casePassed === null)
      return "execution-or-check-failure";
    for (const assertion of assertions) {
      if (
        assertion.errorMessage !== undefined ||
        assertion.abstention !== undefined
      )
        return "execution-or-check-failure";
      if (assertion.type === "rubric") {
        if (
          typeof assertion.score !== "number" ||
          !Number.isFinite(assertion.score) ||
          assertion.score < 0 ||
          assertion.score > 1 ||
          typeof assertion.passed !== "boolean"
        )
          return "execution-or-check-failure";
        if (!assertion.passed) rubricFailed = true;
      } else if (assertion.passed !== true) {
        return "execution-or-check-failure";
      }
    }
  }
  if (
    exitCode === 0 &&
    suite.status === "passed" &&
    !rubricFailed &&
    suite.items.every((item) => item.quality.legacy.casePassed === true)
  )
    return "success";
  if (
    exitCode === 1 &&
    suite.status === "failed" &&
    rubricFailed &&
    suite.items.some((item) => item.quality.legacy.casePassed === false)
  )
    return "rubric-only";
  return "execution-or-check-failure";
};

const owned = (root: string, target: string) => {
  const offset = relative(root, target);
  return (
    offset === "" ||
    (offset !== ".." && !offset.startsWith("../") && !isAbsolute(offset))
  );
};

/** Read only the manifest for one Lux invocation in its private runs root. */
export const readSuiteQuality = async (
  profileRoot: string,
): Promise<SuiteQualityReport | null> => {
  const root = resolve(profileRoot);
  let suiteNames: string[];
  try {
    suiteNames = (await readdir(join(root, ".suites"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  if (suiteNames.length === 0) return null;
  if (suiteNames.length !== 1)
    throw new Error(
      `Expected one Lux suite in ${root}, found ${suiteNames.length}`,
    );
  const suiteDir = join(root, ".suites", suiteNames[0]);
  const manifest = JSON.parse(
    await readFile(join(suiteDir, "suite.json"), "utf8"),
  ) as SuiteManifest;
  if (
    !Array.isArray(manifest.items) ||
    typeof manifest.suiteId !== "string" ||
    typeof manifest.status !== "string"
  ) {
    throw new Error(`Invalid Lux suite manifest: ${suiteDir}`);
  }
  const ownedRoot = await realpath(root);
  const items: SuiteQualityItem[] = [];
  for (const item of manifest.items) {
    if (
      typeof item.caseId !== "string" ||
      typeof item.status !== "string" ||
      (item.runDir !== null && typeof item.runDir !== "string")
    ) {
      throw new Error(`Invalid Lux suite item: ${suiteDir}`);
    }
    let runDir: string | null = null;
    let quality: QualityReport;
    if (item.runDir === null) {
      quality = reportQuality(
        null,
        `${suiteDir}: no run directory for ${item.caseId}`,
      );
    } else {
      runDir = resolve(suiteDir, item.runDir);
      if (!owned(root, runDir))
        throw new Error(`Lux run path escapes private root: ${item.runDir}`);
      try {
        if (!owned(ownedRoot, await realpath(runDir)))
          throw new Error(
            `Lux run symlink escapes private root: ${item.runDir}`,
          );
        try {
          if (!owned(ownedRoot, await realpath(join(runDir, "grading.json"))))
            throw new Error(
              `Lux grade symlink escapes private root: ${item.runDir}`,
            );
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      quality = await readQuality(join(runDir, "grading.json"));
    }
    items.push({
      caseId: item.caseId,
      status: item.status,
      exitReason: item.exitReason,
      runDir,
      quality,
    });
  }
  return {
    suiteDir,
    suiteId: manifest.suiteId,
    profileId: manifest.profileId,
    status: manifest.status,
    items,
  };
};

const label = (dimension: QualityReport["dimensions"]["behavior"]) =>
  dimension.meanScore === null
    ? "unassessed"
    : `${dimension.meanScore.toFixed(2)} (anchor ${dimension.rating}/4)`;

export const formatSuiteQuality = (
  suite: SuiteQualityReport | null,
  profile: string,
): string => {
  if (!suite) return `${profile}: no persisted Lux suite; quality unassessed`;
  const lines = [
    `${profile}: saved-rubric quality estimates (Lux status: ${suite.status}; ${suite.items.length} case attempts)`,
  ];
  const anchors = ["absent", "limited", "partial", "solid", "strong"];
  for (const dimension of ["behavior", "validation", "usability"] as const) {
    const counts = anchors.map(
      (_, rating) =>
        suite.items.filter(
          (item) => item.quality.dimensions[dimension].rating === rating,
        ).length,
    );
    const unassessed = suite.items.filter(
      (item) => item.quality.dimensions[dimension].rating === null,
    ).length;
    lines.push(
      `  ${dimension} distribution: ${anchors.map((anchor, index) => `${anchor} ${counts[index]}`).join(", ")}; unassessed ${unassessed}`,
    );
  }
  for (const item of suite.items) {
    const { behavior, validation, usability } = item.quality.dimensions;
    lines.push(
      `  ${item.caseId}: behavior ${label(behavior)}, validation ${label(validation)}, usability ${label(usability)}; execution ${item.status}${item.exitReason ? `/${item.exitReason}` : ""}`,
    );
    for (const scope of item.quality.scope)
      lines.push(
        `    local scope: ${scope.errorMessage === undefined && scope.abstention === undefined && typeof scope.score === "number" && Number.isFinite(scope.score) && scope.score >= 0 && scope.score <= 1 ? scope.score.toFixed(2) : "unassessed"}; ${scope.comment ?? scope.errorMessage ?? scope.abstention ?? "no feedback"}`,
      );
    for (const note of item.quality.feedback.slice(0, 2))
      lines.push(`    ${note.dimension}: ${note.comment}`);
    if (item.quality.provisional || item.status !== "completed")
      lines.push("    provisional: evidence incomplete");
  }
  lines.push(
    "  Expected assertion inventory is not verified. Ratings projected from saved Lux rubric scores; older binary-calibrated grades are historical diagnostics, not a fresh qualitative regrade.",
  );
  lines.push(`  Suite: ${suite.suiteDir}`);
  return lines.join("\n");
};
