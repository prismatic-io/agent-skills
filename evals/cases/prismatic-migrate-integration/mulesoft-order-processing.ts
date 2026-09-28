import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RubricEvidence } from "@prismatic-io/lux";
import { defineMigrationCase } from "../../migration-case.ts";

const packet = resolve(
  import.meta.dirname,
  "../../fixtures/migrations/mulesoft-order-processing",
);
const read = (name: string) => readFile(resolve(packet, name), "utf8");
const expectations = await read("EXPECTATIONS.md");
const sourceContract = expectations.slice(
  expectations.indexOf("## Grader summary"),
  expectations.indexOf("## Source-supported behavior"),
);

const authored = defineMigrationCase({
  id: "mulesoft-order-processing",
  fixture: resolve(packet, "input"),
  request: await read("REQUEST.txt"),
  persona: await read("PERSONA.md"),
  sourceContract,
  criteria: [
    {
      id: "order-transformation",
      criteria:
        "The registered replacement implements source-derived XML order processing, including the year filter, titles, currency price calculation and author construction. The sample yields the source-compatible JSON order output. Currency data may be supplied locally for verification; do not require a live-capable transport or a specific target representation. Rates must be supplied to processing rather than silently asserted to be permanent production constants. Inspect implemented behavior and caller wiring: copying expected files or hardcoding the sample output does not establish a migrated operation. Do not invent malformed-input or unobserved runtime semantics from the sample XSD.",
    },
    {
      id: "report-and-output-contract",
      criteria:
        "The replacement produces both requested output artifacts. Its CSV report is computed over the original input items independently of the filtered order output, preserving count, total and average for the supplied sample. Preserve meaningful values, structure and ordering; equivalent JSON numeric spellings and CSV quoting/newline formatting are acceptable. Output-file comparison is evidence for the sample only, not general parity. No production filesystem, SFTP service, atomic two-file transaction, exact polling interval, or retry guarantee is supplied; do not require or reward invented contracts. The supporting API console is outside the request.",
    },
  ],
  tests:
    "Exercise the implemented order processing and reporting locally with the authentic XML order sample and currency data, and compare observable outputs with the independent upstream expected artifacts. Establish that the registered integration reaches the implemented behavior; a build, legacy source checks, detached helper tests alone, or pre-copied golden files do not establish that path. Equivalent local test arrangements are acceptable; no evaluator-specific adapter or directory layout is required. The included oracle does not exercise retained-item author deduplication, invalid input or delivery/retry semantics: do not require invented edge expectations or claim those were demonstrated. A comparator match is one dimension alongside execution evidence and source-driven implementation review.",
  tags: ["mulesoft", "xml", "dataweave", "reporting", "transfer"],
});

// Include this source family's contracts and outputs without changing older cases.
for (const assertion of authored.assertions ?? []) {
  if (assertion.type !== "rubric") continue;
  const evidence = (assertion.evidence ?? {}) as Partial<RubricEvidence>;
  assertion.evidence = {
    ...evidence,
    artifactPatterns: [
      ...(evidence.artifactPatterns ?? []),
      "**/*.raml",
      "**/*.xsd",
      "**/*.java",
      "**/orders.json",
      "**/currency.json",
      "**/currency-schema.json",
    ],
  };
}

export default authored;
