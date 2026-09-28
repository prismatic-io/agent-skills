import { describe, expect, it } from "vitest";
import { rankByDimension, reportQuality } from "./quality-report.js";

const entry = (id: string, score: number, passed = true) => ({
  id,
  type: "rubric",
  score,
  passed,
  comment: `${id}: improve contract evidence`,
});

describe("component quality report", () => {
  it("keeps ordinal dimensions separate from legacy binary pass", () => {
    const report = reportQuality({
      casePassed: false,
      caseScore: 0.7,
      assertions: [
        { id: "completed", type: "run-succeeded", passed: true, score: 1 },
        {
          id: "component-checks",
          type: "command-exits-zero",
          passed: true,
          score: 1,
        },
        entry("requested-operations", 0.9),
        entry("trigger", 0.7, false),
        entry("meaningful-tests", 0.45, false),
        entry("nondeveloper-experience", 0.8),
      ],
    });
    expect(report.dimensions.behavior.rating).toBe(3);
    expect(report.dimensions.validation.rating).toBe(2);
    expect(report.dimensions.usability.rating).toBe(3);
    expect(report.execution).toEqual({
      completion: "pass",
      componentChecks: "pass",
    });
    expect(report.legacy.casePassed).toBe(false);
    expect(report.feedback[0]).toMatchObject({
      dimension: "validation",
      criterion: "meaningful-tests",
    });
  });

  it("leaves missing and abstained evidence unassessed, never zero", () => {
    const missing = reportQuality(null);
    expect(missing.dimensions.behavior.rating).toBeNull();
    expect(missing.execution.completion).toBe("unknown");
    const abstained = reportQuality({
      assertions: [
        {
          id: "requested-operations",
          type: "rubric",
          score: 0,
          abstention: "insufficient-evidence",
        },
        entry("meaningful-tests", 0),
      ],
    });
    expect(abstained.dimensions.behavior.rating).toBeNull();
    expect(abstained.dimensions.behavior.missing).toBe(1);
    expect(abstained.dimensions.validation.rating).toBe(0);
  });

  it("reports failed build checks separately from observed source quality", () => {
    const report = reportQuality({
      assertions: [
        { id: "completed", type: "run-succeeded", passed: true, score: 1 },
        {
          id: "component-checks",
          type: "command-exits-zero",
          passed: false,
          score: 0,
        },
        entry("requested-operations", 0.75),
        entry("meaningful-tests", 0.25),
      ],
    });
    expect(report.execution.componentChecks).toBe("fail");
    expect(report.dimensions.behavior.rating).toBe(3);
    expect(report.dimensions.validation.rating).toBe(1);
    expect(report.dimensions.usability.rating).toBeNull();
  });

  it("maps conventional transfer rubric and local check names", () => {
    const report = reportQuality({
      assertions: [
        { id: "completed", type: "run-succeeded", passed: true },
        { id: "local-checks", type: "command-exits-zero", passed: false },
        entry("behavior", 0.75),
        entry("tests", 0.5),
        entry("handoff", 0.9),
      ],
    });
    expect(report.dimensions.behavior.rating).toBe(3);
    expect(report.dimensions.validation.rating).toBe(2);
    expect(report.dimensions.usability.rating).toBe(4);
    expect(report.execution.componentChecks).toBe("fail");
  });

  it("marks unknown execution provisional even with all dimensions scored", () => {
    const report = reportQuality({
      assertions: [
        entry("requested-operations", 0.9),
        entry("meaningful-tests", 0.8),
        entry("nondeveloper-experience", 0.8),
      ],
    });
    expect(report.dimensions.behavior.rating).toBe(4);
    expect(report.execution).toEqual({
      completion: "unknown",
      componentChecks: "unknown",
    });
    expect(report.provisional).toBe(true);
    expect(report.assessmentKind).toBe("saved-rubric-projection");
    expect(report.inventoryVerified).toBe(false);
  });

  it("ranks by an observed dimension, independent of raw casePassed", () => {
    const strong = reportQuality(
      { casePassed: false, assertions: [entry("requested-operations", 0.95)] },
      "strong",
    );
    const weak = reportQuality(
      { casePassed: true, assertions: [entry("requested-operations", 0.2)] },
      "weak",
    );
    const unknown = reportQuality(null, "unknown");
    expect(
      rankByDimension([weak, unknown, strong], "behavior").map(
        (item) => item.source,
      ),
    ).toEqual(["strong", "weak", "unknown"]);
  });

  it("excludes invalid and abstained scores from feedback", () => {
    const report = reportQuality({
      assertions: [
        {
          id: "requested-operations",
          type: "rubric",
          score: Number.POSITIVE_INFINITY,
          comment: "invalid",
        },
        { id: "trigger", type: "rubric", score: -0.2, comment: "out of range" },
        {
          id: "meaningful-tests",
          type: "rubric",
          score: 0,
          abstention: "insufficient-evidence",
          comment: "unknown",
        },
        entry("nondeveloper-experience", 0.5),
      ],
    });
    expect(report.dimensions.behavior.rating).toBeNull();
    expect(report.dimensions.validation.rating).toBeNull();
    expect(report.feedback).toEqual([
      {
        dimension: "usability",
        criterion: "nondeveloper-experience",
        score: 0.5,
        comment: "nondeveloper-experience: improve contract evidence",
      },
    ]);
  });
});
