import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

// Verify untouched upstream assets. Dependency manifests, Docker runtime, and
// yargs initialization are maintained locally; entrypoint behavior has local tests.
const blobs = {
  ".env.dist": "91aab790ae56c0ea479e94d666ff53ae7886735e",
  LICENSE: "90e1189869bbdf9ad327fc64adceb1f02d007be2",
  "README.md": "0aff377d7ae80573c734c6b4c25ceb0dcc6f70c4",
  "action.yml": "99db5a535aef97b909aa2c9166156941b3f11ccf",
  "event-example.json": "8e79710d75d6dc0e27a6ba2a22e0c07450871754",
};
for (const [name, expected] of Object.entries(blobs)) {
  test(`Discord source fixture retains upstream ${name}`, async () => {
    const bytes = await readFile(
      new URL(
        `../../fixtures/migrations/github-actions-discord/input/legacy/${name}`,
        import.meta.url,
      ),
    );
    const actual = createHash("sha1")
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest("hex");
    assert.equal(actual, expected);
  });
}
