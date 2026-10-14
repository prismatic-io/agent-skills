import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { basename, matchesGlob, resolve } from "node:path";
import { RubricConfigSchema } from "@prismatic-io/lux";
import { test } from "vitest";
import authored from "./bespoke-order-sync.ts";
import assessment from "./customer-oauth-handoff.ts";
import cutover from "./cutover-order-sync.ts";
import existing from "./existing-target-boomi.ts";
import customHandoff from "./paragon-send-slack-message.ts";

test("source expectations are grader-only and platform authorization is explicit", () => {
  for (const value of [
    authored,
    assessment,
    cutover,
    existing,
    customHandoff,
  ]) {
    assert.ok(Array.isArray(value.meta?.tags));
    assert.ok(value.meta.tags.includes("train"));
    const scope = value.assertions?.find((a) => a.id === "platform-scope");
    assert.ok(scope?.type === "rubric");
    assert.equal(scope.guidance, undefined);
  }
  for (const [value, fact] of [
    [
      authored,
      "Prismatic successful-execution state persistence is not automatically equivalent to per-page file commit.",
    ],
    [
      assessment,
      "updateInstance with configVariables resets omitted values to defaults/null",
    ],
    [cutover, "The September15 snapshot exceeds seven-day retention"],
    [existing, "Receipt flow stableKey is warehouse-receipt-v1"],
    [
      customHandoff,
      "ResponseStep HTTP200 returns {status: actionStep.output.result.ok}",
    ],
  ] as const) {
    assert.ok(JSON.stringify(value.assertions).includes(fact));
    assert.ok(!value.prompt.includes(fact));
    assert.ok(!String(value.persona).includes(fact));
  }
  assert.match(authored.prompt, /Publish the replacement component/);
});

test("assessment cases retain planning scope without execution checks", () => {
  for (const value of [assessment, cutover]) {
    assert.ok(!value.assertions?.some((a) => a.type === "command-exits-zero"));
    assert.ok(value.assertions?.some((a) => a.id === "meaningful-tests"));
    assert.match(
      value.prompt,
      /This is an assessment; do not change our systems or publish an integration/,
    );
    assert.match(value.prompt, /Keep any rehearsal local and synthetic/);
    const scope = value.assertions?.find((a) => a.id === "platform-scope");
    assert.ok(scope?.type === "rubric");
    assert.match(String(scope.criteria), /do not implement a live cutover/);
  }
});

test("one native dependency-backed check covers build, declared tests and registered execution", () => {
  const commands =
    authored.assertions?.filter(
      (entry) => entry.type === "command-exits-zero",
    ) ?? [];
  assert.equal(commands.length, 1);
  const check = commands[0];
  assert.ok(check?.type === "command-exits-zero");
  assert.equal(check.id, "local-checks");
  assert.equal(check.requiresExecutionWorkspace, true);
  assert.deepEqual(check.command, [
    process.execPath,
    resolve(import.meta.dirname, "../_verify-cni.mjs"),
  ]);
});

test("case-specific handoff requirements remain grader-only", () => {
  const assertion = customHandoff.assertions?.find(
    (entry) => entry.id === "handoff",
  );
  assert.ok(assertion?.type === "rubric");
  assert.match(String(assertion.criteria), /caller|response/i);
  assert.ok(!customHandoff.prompt.includes(String(assertion.criteria)));
  assert.ok(
    !String(customHandoff.persona).includes(String(assertion.criteria)),
  );
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
    assert.equal(typeof authored.fixtures, "string");
    assert.equal(
      authored.assertions.filter(
        (entry: { id?: string }) => entry.id === "meaningful-tests",
      ).length,
      1,
      `${filename} must inherit exactly one verification check`,
    );
    for (const assertion of authored.assertions ?? []) {
      if (assertion.type === "rubric") {
        assert.ok(
          RubricConfigSchema.safeParse(assertion).success,
          `${filename}: ${assertion.id} exceeds Lux rubric budget`,
        );
        if (assertion.id === "meaningful-tests") {
          assert.equal(assertion.informational, true);
          assert.equal(assertion.threshold, undefined);
        } else {
          assert.notEqual(assertion.informational, true);
          assert.equal(assertion.threshold ?? 0.8, 0.8);
        }
      }
    }
    assert.equal(basename(authored.fixtures), "input");
    const files = await readdir(
      resolve(import.meta.dirname, authored.fixtures),
      { recursive: true },
    );
    assert.ok(files.length > 0, filename);
    assert.ok(
      !files.some((name) => /grader|rubric/i.test(String(name))),
      filename,
    );
  }
});

test("behavioral grading receives execution results", () => {
  const assertions = authored.assertions ?? [];
  for (const id of ["meaningful-tests", "platform-scope"]) {
    const assertion = assertions.find((entry) => entry.id === id);
    assert.ok(assertion && "evidence" in assertion && "criteria" in assertion);
    const selected = RubricConfigSchema.parse(assertion).evidence;
    assert.ok(selected.eventTypes.includes("tool-call"));
    assert.ok(selected.eventTypes.includes("tool-result"));
    assert.equal(selected.toolDetail, "inputs-and-results");
  }
});

test("grader includes generated JSON test inputs without normal dependency lockfiles", () => {
  const assertion = authored.assertions?.find(
    (entry) => entry.id === "meaningful-tests",
  );
  assert.ok(assertion && "evidence" in assertion);
  const { artifactPatterns: patterns, artifactExcludes: excludes = [] } =
    RubricConfigSchema.parse(assertion).evidence;
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
    "port/pnpm-lock.yaml",
  ])
    assert.ok(
      excludes.some((pattern) => matchesGlob(file, pattern)),
      file,
    );
});

test("existing integration cases extend the supplied project and retain build verification", () => {
  const result = existing;
  assert.match(result.prompt, /Update our existing Prismatic integration here/);
  assert.doesNotMatch(result.prompt, /new top-level subdirectory/);
  assert.ok(result.assertions?.some(({ id }) => id === "local-checks"));
});
