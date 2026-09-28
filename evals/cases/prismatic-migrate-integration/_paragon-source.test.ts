import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "vitest";

test("Paragon fixture source declarations remain bounded to the supplied graph", () => {
  const output = execFileSync(
    process.execPath,
    [
      "--test",
      resolve(
        import.meta.dirname,
        "../../fixtures/migrations/paragon-send-slack-message/source-declarations.test.mjs",
      ),
    ],
    { encoding: "utf8", timeout: 30_000 },
  );
  assert.match(output, /# pass 6/);
  assert.match(output, /# fail 0/);
});
