import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

// Verify unchanged fixture bytes; this does not test replacement behavior.
const blobs = {
  ".env.dist": "91aab790ae56c0ea479e94d666ff53ae7886735e",
  Dockerfile: "c72973166bdfa1a2d59e451e3c28d01d33f32176",
  LICENSE: "90e1189869bbdf9ad327fc64adceb1f02d007be2",
  "README.md": "0aff377d7ae80573c734c6b4c25ceb0dcc6f70c4",
  "action.yml": "99db5a535aef97b909aa2c9166156941b3f11ccf",
  "entrypoint.js": "eb52dd7c8b6763ae615304533f1675377867fb7f",
  "event-example.json": "8e79710d75d6dc0e27a6ba2a22e0c07450871754",
  "package-lock.json": "290aae5b10677bc2738f7c6e051b30196e8f6135",
  "package.json": "ffb9ddc0e8fe87303f608e8b1e0cde6eea52c027",
};
for (const [name, expected] of Object.entries(blobs)) {
  test(`Discord source fixture retains upstream ${name}`, async () => {
    const bytes = await readFile(
      new URL(
        `./fixtures/migrations/github-actions-discord/input/legacy/${name}`,
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
