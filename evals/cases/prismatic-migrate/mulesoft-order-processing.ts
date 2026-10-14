import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as suite from "./_suite.ts";

const packet = resolve(
  import.meta.dirname,
  "../../fixtures/migrations/mulesoft-order-processing",
);
const read = (name: string) => readFile(resolve(packet, name), "utf8");

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/mulesoft-order-processing/input",
  prompt: suite.prompt(await read("REQUEST.txt")),
  persona: await read("PERSONA.md"),
  assertions: [
    {
      type: "rubric",
      id: "order-transformation",
      criteria:
        "The registered replacement implements source-derived XML order processing, including the year filter, titles, currency price calculation and author construction. The sample yields the source-compatible JSON order output. Currency data may be supplied locally for verification; do not require a live-capable transport or a specific target representation. Rates must be supplied to processing rather than silently asserted to be permanent production constants. Inspect implemented behavior and caller wiring: copying expected files or hardcoding the sample output does not establish a migrated operation. Do not invent malformed-input or unobserved runtime semantics from the sample XSD. Source filters year > 2004, multiplies prices by supplied USD currency ratios and constructs authors using distinctBy. The upstream-asserted sample yields Everyday Italian then Harry Potter with EUR/ARS/GBP prices; it is not fresh native Mule execution.",
    },
    {
      type: "rubric",
      id: "report-and-output-contract",
      criteria:
        "The replacement produces both requested output artifacts. Its CSV report is computed over the original input items independently of the filtered order output, preserving count, total and average for the supplied sample. Preserve meaningful values, structure and ordering; equivalent JSON numeric spellings and CSV quoting/newline formatting are acceptable. Output-file comparison is evidence for the sample only, not general parity. No production filesystem, SFTP service, atomic two-file transaction, exact polling interval, or retry guarantee is supplied; do not require or reward invented contracts. The supporting API console is outside the request. The supplied sample report counts all four original items, totals 149.93 and averages 37.4825. Author deduplication is present in source but not demonstrated by this sample because its duplicate-author item is filtered out.",
    },
  ],
});
