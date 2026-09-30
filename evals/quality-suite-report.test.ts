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
  items: Array<{
    caseId: string;
    status: string;
    runDir: string | null;
    exitReason?: string;
    casePassed?: boolean | null;
  }>,
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
  it("recognizes the saved Claude/Codex abstention schema without hiding check failures", async () => {
    // Both corrected migration smoke runs saved a passed suite and null case
    // result, despite CLI exit 1. The local-scope rubric abstained with score 0.
    const { root } = await fixture(
      [
        {
          caseId: "prismatic-migrate-integration/workato-contact",
          status: "completed",
          runDir: "../../workato-contact/codex/one",
          exitReason: "done",
          casePassed: null,
        },
      ],
      "passed",
    );
    const run = join(root, "workato-contact", "codex", "one");
    await mkdir(run, { recursive: true });
    const assertions: GradeEntry[] = [
      { id: "completed", type: "run-succeeded", passed: true, score: 1 },
      { id: "local-build", type: "command-exits-zero", passed: true, score: 1 },
      {
        id: "project-checks",
        type: "command-exits-zero",
        passed: true,
        score: 1,
      },
      {
        id: "callable-contact-behavior",
        type: "rubric",
        passed: true,
        score: 0.8,
      },
      {
        id: "failure-and-connection-contract",
        type: "rubric",
        passed: true,
        score: 0.8,
      },
      { id: "meaningful-tests", type: "rubric", passed: true, score: 0.6 },
      { id: "handoff", type: "rubric", passed: true, score: 0.8 },
      {
        id: "local-scope",
        type: "rubric",
        passed: false,
        score: 0,
        abstention: "insufficient-evidence",
      },
    ];
    await writeFile(
      join(run, "grading.json"),
      JSON.stringify({
        schemaVersion: 1,
        casePassed: null,
        caseScore: null,
        assertions,
      }),
    );
    const saved = await readSuiteQuality(root);
    expect(saved?.items[0].quality.legacy.casePassed).toBeNull();
    expect(classifySuiteOutcome(saved, 1, null)).toBe("grading-incomplete");
    expect(classifySuiteOutcome(saved, 0, null)).toBe(
      "execution-or-check-failure",
    );
    expect(classifySuiteOutcome(saved, 1, "SIGTERM")).toBe(
      "execution-or-check-failure",
    );
    if (!saved) throw new Error("Missing fixture suite");
    expect(classifySuiteOutcome({ ...saved, status: "running" }, 1, null)).toBe(
      "execution-or-check-failure",
    );
    for (const passed of [false, null] as const) {
      const failedCheck = reportQuality({
        casePassed: null,
        assertions: assertions.map((entry) =>
          entry.id === "project-checks" ? { ...entry, passed } : entry,
        ),
      });
      expect(
        classifySuiteOutcome(
          { ...saved, items: [{ ...saved.items[0], quality: failedCheck }] },
          1,
          null,
        ),
      ).toBe("execution-or-check-failure");
    }
    // An abstention in one case cannot explain an unrelated unknown case.
    const unknown = {
      ...saved.items[0],
      caseId: "unknown",
      quality: reportQuality({
        casePassed: null,
        assertions: assertions.slice(0, -1),
      }),
    };
    expect(classifySuiteOutcome({ ...saved, items: [unknown] }, 1, null)).toBe(
      "execution-or-check-failure",
    );
    expect(
      classifySuiteOutcome(
        { ...saved, items: [...saved.items, unknown] },
        1,
        null,
      ),
    ).toBe("execution-or-check-failure");
    expect(
      classifySuiteOutcome(
        {
          ...saved,
          items: [...saved.items, { ...unknown, quality: reportQuality(null) }],
        },
        1,
        null,
      ),
    ).toBe("execution-or-check-failure");
  });

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
    ).toBe("grading-incomplete");
    expect(
      classifySuiteOutcome(
        suite([...checks, { ...rubric, abstention: "insufficient-evidence" }]),
        1,
        null,
      ),
    ).toBe("grading-incomplete");
    expect(
      classifySuiteOutcome(
        suite([...checks, { ...rubric, errorMessage: "grader unavailable" }]),
        1,
        null,
      ),
    ).toBe("grading-incomplete");
    expect(
      classifySuiteOutcome(
        suite([...checks.slice(0, 2), { ...checks[2], passed: false }, rubric]),
        1,
        null,
      ),
    ).toBe("execution-or-check-failure");
    expect(
      classifySuiteOutcome(
        suite([
          { ...rubric, abstention: "insufficient-evidence" },
          ...checks.slice(0, 2),
          { ...checks[2], passed: false },
        ]),
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
