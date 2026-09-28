import assert from "node:assert/strict";
import type { GradingReport } from "@prismatic-io/lux";
import { test } from "vitest";
import { summarizeMigration } from "./migration-results.ts";

const entry = (id: string, passed = false) => ({
  id,
  type: "rubric",
  name: id,
  passed,
  score: Number(passed),
  weight: 1,
  threshold: 1,
  durationMs: 0,
});
const report = (assertions: GradingReport["assertions"]): GradingReport => ({
  schemaVersion: 1,
  casePassed: false,
  caseScore: 0,
  assertions,
});

test("verification and hygiene failures do not become behavior defects", () => {
  const result = summarizeMigration(
    report([
      entry("message-effects", true),
      entry("local-build", true),
      entry("project-checks"),
      entry("behavioral-verification"),
    ]),
  );
  assert.equal(result.casePassed, false);
  assert.equal(result.dimensions.behavior[0]?.outcome, "pass");
  assert.equal(result.dimensions.build[0]?.outcome, "pass");
  assert.equal(result.dimensions["project-checks"][0]?.outcome, "fail");
  assert.equal(result.dimensions.verification[0]?.outcome, "fail");
});

test("missing evidence, grader errors, and skipped checks remain distinct", () => {
  const result = summarizeMigration({
    ...report([
      { ...entry("auth"), abstention: "insufficient-evidence" },
      { ...entry("completed"), errorMessage: "collector unavailable" },
    ]),
    casePassed: null,
    skippedAssertions: [
      {
        id: "honest-handoff",
        type: "rubric",
        name: "handoff",
        reason: "judge-disabled",
      },
    ],
  });
  assert.equal(result.complete, false);
  assert.equal(result.dimensions.behavior[0]?.outcome, "unknown");
  assert.equal(result.dimensions.execution[0]?.outcome, "grading-error");
  assert.equal(
    result.dimensions.execution[0]?.errorMessage,
    "collector unavailable",
  );
  assert.equal(result.dimensions.handoff[0]?.outcome, "not-graded");
  assert.deepEqual(result.dimensions.build, []);
  const partial = summarizeMigration({
    ...report([
      entry("local-build"),
      {
        ...entry("behavioral-verification"),
        abstention: "insufficient-evidence",
      },
    ]),
  });
  assert.equal(partial.complete, false);
  assert.equal(partial.casePassed, false);
});
