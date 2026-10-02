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

test("the Codex profile switches subject, persona, and judge together", () => {
  const profile = config.profiles?.codex;
  const harness = {
    provider: "codex",
    inheritEnv: [],
    model: codexDriver.config.model,
    reasoningEffort: codexDriver.config.reasoningEffort,
  };
  assert.deepEqual(profile?.driver, codexDriver);
  assert.deepEqual(profile?.answerer, { name: "persona", config: harness });
  assert.deepEqual(profile?.harness, harness);
});
