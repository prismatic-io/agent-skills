import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { matchesGlob, resolve } from "node:path";
import { RubricConfigSchema } from "@prismatic-io/lux";
import { test } from "vitest";
import authored from "./cases/prismatic-migrate-integration/mulesoft-order-processing.ts";

const checker = resolve(
  import.meta.dirname,
  "fixtures/migrations/mulesoft-order-processing/check.py",
);
const run = (command: string) => {
  const result = spawnSync("python3", [checker, command], {
    encoding: "utf8",
    timeout: 10_000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
};

test("Mule source bytes and independently asserted sample outputs agree", () => {
  const result = run("verify-source");
  assert.equal(result.source_files_verified, 28);
  assert.equal(result.sample_orders, 4);
  assert.equal(result.sample_output_orders, 2);
  assert.equal(result.native_runtime_executed, false);
});

test("Mule comparator rejects changed behavior and accepts documented formatting", () => {
  const result = run("self-test");
  assert.deepEqual(result.rejected_mutations, [
    "missing-order",
    "changed-title-whitespace",
    "string-price",
    "wrong-report",
    "underscore-decimal",
  ]);
  assert.deepEqual(result.accepted, [
    "upstream expected sample",
    "equivalent numeric and newline formatting",
  ]);
  assert.equal(result.target_or_source_runtime_executed, false);
});

test("Mule authored rubrics satisfy the actual Lux runtime schema", () => {
  for (const assertion of authored.assertions ?? []) {
    if (assertion.type !== "rubric") continue;
    const parsed = RubricConfigSchema.safeParse(assertion);
    assert.ok(
      parsed.success,
      `${assertion.id}: ${JSON.stringify(parsed.error)}`,
    );
  }
});

test("Mule discovery separates source inputs, review evidence and project checks", async () => {
  assert.equal(
    authored.id,
    "prismatic-migrate-integration/mulesoft-order-processing",
  );
  const fixture = authored.fixtures;
  assert.ok(fixture && typeof fixture === "object" && fixture.kind === "dir");
  const files = await readdir(fixture.path, { recursive: true });
  assert.ok(
    files.some((name) =>
      name.endsWith("ProcessingOrdersWithDataweaveAndApikitIT.java"),
    ),
  );
  assert.ok(
    files.some((name) => name.endsWith("src/main/resources/orders.json")),
  );
  assert.ok(
    !files.some((name) =>
      /EXPECTATIONS|check\.py|source-files\.json/.test(name),
    ),
  );
  assert.doesNotMatch(
    authored.prompt,
    /37\.4825|149\.93|Source-supported behavior/,
  );
  assert.doesNotMatch(String(authored.persona), /37\.4825|149\.93/);
  const ids = authored.assertions?.map(({ id }) => id);
  for (const id of [
    "local-build",
    "project-checks",
    "order-transformation",
    "report-and-output-contract",
    "behavioral-verification",
    "honest-handoff",
    "local-boundary",
  ])
    assert.ok(ids?.includes(id), id);
  assert.ok(
    !authored.assertions?.some(
      (assertion) =>
        assertion.type === "command-exits-zero" &&
        String(assertion.command).includes("check.py"),
    ),
  );
  const report = authored.assertions?.find(
    ({ id }) => id === "report-and-output-contract",
  );
  assert.ok(report?.type === "rubric");
  assert.match(String(report.criteria), /149\.93/);
  assert.match(String(report.criteria), /## Grader summary/);
  assert.match(String(report.criteria), /not fresh native Mule execution/);
  const evidence = report.evidence as { artifactPatterns: string[] };
  for (const file of [
    "port/output/orders.json",
    "port/output/report.csv",
    "source/project/src/main/app/books.xml",
    "source/project/src/main/resources/orders.xsd",
    "source/project/src/main/resources/currency.json",
    "source/project/src/main/api/currency.raml",
    "source/project/src/test/java/ProcessingOrdersWithDataweaveAndApikitIT.java",
  ])
    assert.ok(
      evidence.artifactPatterns.some((pattern) => matchesGlob(file, pattern)),
      file,
    );
});
