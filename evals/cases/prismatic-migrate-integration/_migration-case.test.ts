import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { matchesGlob, resolve } from "node:path";
import { test } from "vitest";
import {
  defineMigrationCase,
  type MigrationCase,
  migrationAssertions,
  migrationVariant,
  summarizeSuppliedFiles,
} from "./_migration-case.ts";

const spec: MigrationCase = {
  id: "harness-test",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/bespoke-order-sync/input",
  ),
  request: "Migrate the supplied integration.",
  persona: "No production credentials are available.",
  sourceContract:
    "PRIVATE_GRADER_FACT: source commits after each completed page.",
  criteria: [
    { id: "page-progress", criteria: "Preserve durable page progress." },
  ],
  tests: "Demonstrate page failure and resume.",
};

test("baseline variants change only skill selection and variant metadata", () => {
  const migration = defineMigrationCase(spec, "migration");
  const build = defineMigrationCase(spec, "build");
  const none = defineMigrationCase(spec, "none");
  assert.match(migration.prompt, /prismatic-migrate-integration\/SKILL.md/);
  assert.match(build.prompt, /prismatic-build-integration\/SKILL.md/);
  assert.doesNotMatch(none.prompt, /Use the skill/);
  assert.equal(migration.prompt.split("\n").slice(1).join("\n"), none.prompt);
  assert.equal(build.prompt.split("\n").slice(1).join("\n"), none.prompt);
  assert.deepEqual(migration.fixtures, none.fixtures);
  assert.deepEqual(migration.assertions, none.assertions);
  assert.deepEqual(build.assertions, none.assertions);
  assert.equal(migration.meta?.variant, "migration");
  assert.equal(none.meta?.skill, "none");
});

test("invalid baseline selectors fail rather than silently choosing a skill", () => {
  for (const variant of ["migration", "build", "none"] as const) {
    assert.equal(migrationVariant(variant), variant);
  }
  assert.throws(() => migrationVariant("typo"), /PRISM_MIGRATION_SKILL/);
});

test("source expectations are grader-only and local constraints survive all variants", () => {
  for (const variant of ["migration", "build", "none"] as const) {
    const result = defineMigrationCase(spec, variant);
    assert.doesNotMatch(
      result.prompt,
      /PRIVATE_GRADER_FACT|durable page progress/,
    );
    assert.doesNotMatch(String(result.persona ?? ""), /PRIVATE_GRADER_FACT/);
    assert.match(
      result.prompt,
      /Do not mutate Prismatic or connected services/,
    );
    assert.match(JSON.stringify(result.assertions), /PRIVATE_GRADER_FACT/);
    assert.ok(
      Array.isArray(result.meta?.tags) && result.meta.tags.includes("train"),
    );
    assert.ok(
      !(
        Array.isArray(result.meta?.tags) &&
        result.meta.tags.includes("held-out")
      ),
    );
  }
});

test("assessment cases can disclose genuine blockers without fabricating a build", () => {
  assert.ok(migrationAssertions(spec).some(({ id }) => id === "local-build"));
  const assessment = defineMigrationCase({
    ...spec,
    deliverable: "assessment",
  });
  assert.ok(!assessment.assertions?.some(({ id }) => id === "local-build"));
  assert.ok(assessment.assertions?.some(({ id }) => id === "meaningful-tests"));
  assert.ok(assessment.assertions?.some(({ id }) => id === "local-scope"));
  assert.match(assessment.prompt, /available evidence/);
});

test("authored cases copy only input directories, excluding grader answers", async () => {
  const directory = resolve(import.meta.dirname, ".");
  const cases = (await readdir(directory)).filter(
    (name) => name.endsWith(".ts") && !name.startsWith("_"),
  );
  assert.equal(cases.length, 21);
  for (const filename of cases) {
    const { default: authored } = await import(resolve(directory, filename));
    assert.equal(
      authored.driver,
      undefined,
      `${filename} must inherit the shared driver`,
    );
    assert.equal(
      authored.answerer,
      undefined,
      `${filename} must use the configured answerer`,
    );
    assert.equal(authored.fixtures.kind, "dir");
    for (const assertion of authored.assertions ?? []) {
      if (assertion.type === "rubric") {
        assert.ok(
          String(assertion.criteria).length <= 8_000,
          `${filename}: ${assertion.id} exceeds Lux rubric budget`,
        );
        assert.equal(
          assertion.threshold,
          0,
          `${filename}: quality rubrics must not impose a pass threshold`,
        );
      }
    }
    assert.equal(authored.fixtures.path.split("/").at(-1), "input");
    const files = await readdir(authored.fixtures.path, { recursive: true });
    assert.ok(files.length > 0, filename);
    assert.ok(
      !files.some((name) => /grader|rubric/i.test(String(name))),
      filename,
    );
  }
});

test("behavioral grading receives execution results and missing trace cannot prove a clean run", () => {
  const assertions = migrationAssertions(spec);
  for (const id of ["meaningful-tests", "local-scope"]) {
    const assertion = assertions.find((entry) => entry.id === id);
    assert.ok(assertion && "evidence" in assertion && "criteria" in assertion);
    const selected = assertion.evidence as {
      eventTypes: string[];
      toolDetail: string;
    };
    assert.ok(selected.eventTypes.includes("tool-call"));
    assert.ok(selected.eventTypes.includes("tool-result"));
    assert.equal(selected.toolDetail, "inputs-and-results");
    assert.match(String(assertion.criteria), /abstain/);
  }
});

test("grader includes generated JSON test inputs without normal dependency lockfiles", () => {
  const assertion = migrationAssertions(spec).find(
    (entry) => entry.id === "meaningful-tests",
  );
  assert.ok(assertion && "evidence" in assertion);
  const patterns = (assertion.evidence as { artifactPatterns: string[] })
    .artifactPatterns;
  for (const file of [
    "order-sync/fixtures/order.intl.json",
    "order-sync/fixtures/span.json",
    "port/tests/data/payload.json",
    "port/__fixtures__/order.json",
    "port/example.fixture.json",
    "port/fixtures/legacy-expected/amounts.jsonl",
    "legacy/upsert-contact.json",
    "legacy/workflow.json",
    "operations/checkpoint-packet.json",
    "operations/last-run.log",
    "legacy/import.py",
    "legacy/settlements.csv",
    "legacy/message.eml",
    "port/tests/nested-message.eml",
    "legacy/transform.dwl",
  ])
    assert.ok(
      patterns.some((pattern) => matchesGlob(file, pattern)),
      file,
    );
  for (const file of [
    "package-lock.json",
    "port/package-lock.json",
    "port/pnpm-lock.yaml.json",
  ])
    assert.ok(!patterns.some((pattern) => matchesGlob(file, pattern)), file);
});

test("existing integration cases extend the supplied project and retain build verification", () => {
  const result = defineMigrationCase({
    ...spec,
    deliverable: "existing-integration",
  });
  assert.match(result.prompt, /Extend the supplied.*in place/);
  assert.doesNotMatch(result.prompt, /new top-level subdirectory/);
  assert.ok(result.assertions?.some(({ id }) => id === "local-build"));
});

test("large fixture summaries preserve source identity within the rubric budget", () => {
  assert.equal(
    summarizeSuppliedFiles(["legacy/source.py"]),
    "legacy/source.py",
  );
  const files = Array.from(
    { length: 100 },
    (_, index) => `legacy/deep/source-${index}.js`,
  );
  const summary = summarizeSuppliedFiles(files);
  assert.match(summary, /100 files/);
  assert.match(summary, /legacy\/ \(100\)/);
  assert.ok(summary.length < 500);
  assert.match(summary, /newly created files.*not automatically supplied/);
});
