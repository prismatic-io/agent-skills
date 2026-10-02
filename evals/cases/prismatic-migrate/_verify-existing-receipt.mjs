#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { parse } from "yaml";
import { prismRoot } from "../../prism.ts";

const project = resolve(process.argv[2] ?? ".", "existing-integration");

// Run inside the disposable verification workspace supplied by Lux.
const directory = project;
const build = spawnSync("npm", ["run", "build"], {
  cwd: directory,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
assert.ifError(build.error);
assert.equal(build.status, 0, "Existing integration must still build");
const validation = spawnSync(
  process.execPath,
  [
    resolve(prismRoot, "lib/run.js"),
    "integrations",
    "validate",
    "--format",
    "json",
  ],
  {
    cwd: directory,
    env: process.env,
    encoding: "utf8",
  },
);
assert.ifError(validation.error);
assert.equal(validation.status, 0, validation.stderr || validation.stdout);
const { entrypoint } = JSON.parse(validation.stdout);
const require = createRequire(import.meta.url);
const component = require(entrypoint).default;
const definition = parse(component.codeNativeIntegrationYAML);
const flow = definition.flows.find(
  (item) => item.stableKey === "warehouse-receipt-v1",
);
assert.ok(flow, "Existing receipt flow identity must survive migration");
const configuration = definition.requiredConfigVars.find(
  (item) => item.key === "Receipt Prefix",
);
assert.equal(configuration?.stableKey, "warehouse-receipt-prefix");
const step = flow.steps.find(
  (item) => !item.isTrigger && item.action?.component?.key === component.key,
);
assert.ok(step, "Receipt flow must reference an executable action");
const execute = component.actions[step.action.key].perform;
const invoke = (body, prefix) =>
  execute(
    {
      configVars: { "Receipt Prefix": prefix },
      instanceState: {},
      crossFlowState: {},
      executionState: {},
      integrationState: {},
      globalDebug: false,
      logger: { info() {}, warn() {}, error() {}, debug() {}, metric() {} },
    },
    { onTrigger: { results: { body: { data: body } } } },
  );
for (const [prefix, warehouse, eventId] of [
  ["RECEIVED", "phx-west", "receipt/009"],
  ["WH", "east:annex", "event:0007+retry"],
]) {
  assert.deepEqual((await invoke({ eventId, warehouse }, prefix)).data, {
    eventId,
    reference: `${prefix}:${warehouse}:${eventId}`,
    status: "accepted",
  });
}
await assert.rejects(
  () => invoke({ warehouse: "phx-west" }, "RCPT"),
  /eventId must be a nonempty string/,
);
await assert.rejects(
  () => invoke({ eventId: "evt" }, "RCPT"),
  /warehouse must be a nonempty string/,
);
console.log("Existing registered receipt flow preserves its caller contract.");
