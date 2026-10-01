import assert from "node:assert/strict";
import { test } from "vitest";
import config, { codexDriver } from "./lux.config.ts";

test("drivers and every profile omit Prism read-only policy", () => {
  assert.doesNotMatch(JSON.stringify(config), /PRISM_READ_ONLY/);
  assert.deepEqual(Object.keys(config.profiles ?? {}).sort(), [
    "claude-code",
    "codex",
  ]);
});
