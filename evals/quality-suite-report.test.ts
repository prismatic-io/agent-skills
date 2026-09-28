import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type GradeEntry, reportQuality } from "./quality-report.ts";
import {
  classifySuiteOutcome,
  formatSuiteQuality,
  readSuiteQuality,
} from "./quality-suite-report.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
const fixture = async (
  items: Array<{ caseId: string; status: string; runDir: string | null }>,
  status = "failed",
) => {
  const root = await mkdtemp(join(tmpdir(), "quality-suite-"));
  roots.push(root);
  const suiteDir = join(root, ".suites", "one");
  await mkdir(suiteDir, { recursive: true });
  await writeFile(
    join(suiteDir, "suite.json"),
    JSON.stringify({ suiteId: "one", profileId: "codex", status, items }),
  );
  return { root, suiteDir };
};

describe("private Lux suite quality report", () => {
  it("forgives only an observed rubric-only exit one", () => {
    const checks: GradeEntry[] = [
      { id: "completed", type: "run-succeeded", passed: true, score: 1 },
      {
        id: "component-checks",
        type: "command-exits-zero",
        passed: true,
        score: 1,
      },
      {
        id: "custom-check",
        type: "command-exits-zero",
        passed: true,
        score: 1,
      },
    ];
    const rubric: GradeEntry = {
      id: "behavior",
      type: "rubric",
      score: 0.75,
      passed: false,
    };
    const suite = (assertions: GradeEntry[]) => ({
      suiteDir: "private",
      suiteId: "one",
      status: "failed",
      items: [
        {
          caseId: "case",
          status: "completed",
          exitReason: "done",
          runDir: "private/case",
          quality: reportQuality({ casePassed: false, assertions }),
        },
      ],
    });
    expect(classifySuiteOutcome(suite([...checks, rubric]), 1, null)).toBe(
      "rubric-only",
    );
    expect(classifySuiteOutcome(suite([...checks, rubric]), 2, null)).toBe(
      "execution-or-check-failure",
    );
    expect(
      classifySuiteOutcome(
        suite([...checks, { ...rubric, score: null }]),
        1,
        null,
      ),
    ).toBe("execution-or-check-failure");
    expect(
      classifySuiteOutcome(
        suite([...checks, { ...rubric, abstention: "insufficient-evidence" }]),
        1,
        null,
      ),
    ).toBe("execution-or-check-failure");
    expect(
      classifySuiteOutcome(
        suite([...checks, { ...rubric, errorMessage: "grader unavailable" }]),
        1,
        null,
      ),
    ).toBe("execution-or-check-failure");
    expect(
      classifySuiteOutcome(
        suite([...checks.slice(0, 2), { ...checks[2], passed: false }, rubric]),
        1,
        null,
      ),
    ).toBe("execution-or-check-failure");
    expect(classifySuiteOutcome(suite([...checks, rubric]), 1, "SIGTERM")).toBe(
      "execution-or-check-failure",
    );
  });
  it("reads only manifest-named runs and retains every case denominator", async () => {
    const { root, suiteDir } = await fixture([
      { caseId: "good", status: "completed", runDir: "../../good/codex/one" },
      {
        caseId: "failed",
        status: "completed",
        runDir: "../../failed/codex/one",
      },
      { caseId: "pending", status: "pending", runDir: null },
      {
        caseId: "missing-grade",
        status: "completed",
        runDir: "../../missing/codex/one",
      },
    ]);
    for (const [name, score] of [
      ["good", 0.9],
      ["failed", 0.4],
    ] as const) {
      const run = join(root, name, "codex", "one");
      await mkdir(run, { recursive: true });
      await writeFile(
        join(run, "grading.json"),
        JSON.stringify({
          assertions: [
            {
              id: "requested-operations",
              type: "rubric",
              score,
              comment: "Fix the observed contract mismatch",
            },
            {
              id: "meaningful-tests",
              type: "rubric",
              score: 0.6,
              comment: "Exercise the registered behavior",
            },
            {
              id: "nondeveloper-experience",
              type: "rubric",
              score: 0.8,
              comment: "Describe setup",
            },
          ],
        }),
      );
    }
    const unrelated = join(root, "unrelated", "grading.json");
    await mkdir(join(root, "unrelated"));
    await writeFile(unrelated, "invalid JSON");
    const report = await readSuiteQuality(root);
    expect(report?.items.map((item) => item.caseId)).toEqual([
      "good",
      "failed",
      "pending",
      "missing-grade",
    ]);
    expect(
      report?.items.map((item) => item.quality.dimensions.behavior.rating),
    ).toEqual([4, 2, null, null]);
    expect(formatSuiteQuality(report, "codex")).toContain(
      "pending: behavior unassessed",
    );
    expect(formatSuiteQuality(report, "codex")).toContain(
      "behavior distribution: absent 0, limited 0, partial 1, solid 0, strong 1; unassessed 2",
    );
    expect(report?.suiteDir).toBe(suiteDir);
  });

  it("rejects a run path outside its owned root, including symlink escapes", async () => {
    const { root } = await fixture([
      { caseId: "foreign", status: "completed", runDir: "../../../elsewhere" },
    ]);
    await expect(readSuiteQuality(root)).rejects.toThrow(
      "escapes private root",
    );
    const outside = await mkdtemp(join(tmpdir(), "foreign-suite-"));
    roots.push(outside);
    const second = await fixture([
      { caseId: "link", status: "completed", runDir: "../../linked" },
    ]);
    await symlink(outside, join(second.root, "linked"));
    await expect(readSuiteQuality(second.root)).rejects.toThrow(
      "symlink escapes private root",
    );
    const third = await fixture([
      { caseId: "grade-link", status: "completed", runDir: "../../inside" },
    ]);
    await mkdir(join(third.root, "inside"));
    await writeFile(join(outside, "grading.json"), "{}");
    await symlink(
      join(outside, "grading.json"),
      join(third.root, "inside", "grading.json"),
    );
    await expect(readSuiteQuality(third.root)).rejects.toThrow(
      "grade symlink escapes private root",
    );
  });

  it("handles no suite and refuses ambiguous suites", async () => {
    const root = await mkdtemp(join(tmpdir(), "empty-suite-"));
    roots.push(root);
    expect(await readSuiteQuality(root)).toBeNull();
    expect(formatSuiteQuality(null, "codex")).toContain("unassessed");
    const { root: occupied } = await fixture([]);
    await mkdir(join(occupied, ".suites", "two"));
    await expect(readSuiteQuality(occupied)).rejects.toThrow(
      "Expected one Lux suite",
    );
  });
});
