import assert from "node:assert/strict";
import { createRequire, syncBuiltinESMExports } from "node:module";
import net from "node:net";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { resolveCniEntrypoint } from "../_cni-entrypoint.mjs";

// Registration should be local. This is not a sandbox for arbitrary code;
// generated scripts and modules still belong in a disposable environment.
const denyNetwork = () => {
  throw new Error("Network connections are disabled during CNI entry loading.");
};
globalThis.fetch = denyNetwork;
net.Socket.prototype.connect = denyNetwork;
syncBuiltinESMExports();

const directory = resolve(process.argv[2]);
const require = createRequire(pathToFileURL(join(directory, "package.json")));
const entry = await resolveCniEntrypoint(directory);
const definition = require(entry).default;
assert.equal(
  typeof definition?.codeNativeIntegrationYAML,
  "string",
  "Prism CNI entry must export a default integration with YAML text",
);
const integration = parse(definition.codeNativeIntegrationYAML);
assert.equal(
  integration?.isCodeNative,
  true,
  "Missing code-native integration definition",
);
assert.ok(
  typeof definition.key === "string" && definition.key.trim().length > 0,
  "Missing generated component key",
);
assert.ok(
  Array.isArray(integration.flows) && integration.flows.length > 0,
  "Integration must register at least one flow",
);
// Spectral's convertFlow emits a trigger plus an onExecution action referencing
// the generated component. The trigger may belong to a public component instead.
// Check the compiled wiring without invoking business behavior or remote services.
for (const flow of integration.flows) {
  assert.ok(Array.isArray(flow?.steps), "Flow must register steps");
  assert.ok(
    flow.steps.some(
      (step) =>
        step?.isTrigger === true &&
        typeof step.action?.key === "string" &&
        step.action.key.length > 0 &&
        typeof step.action?.component?.key === "string" &&
        step.action.component.key.length > 0,
    ),
    `Flow ${flow.name} has no registered trigger`,
  );
  const execution = flow.steps.find(
    (step) =>
      !step?.isTrigger && step?.action?.component?.key === definition.key,
  );
  assert.ok(
    execution,
    `Flow ${flow.name} does not reference its generated execution action`,
  );
  for (const step of flow.steps) {
    if (step?.action?.component?.key !== definition.key) continue;
    const members = step.isTrigger ? definition.triggers : definition.actions;
    assert.ok(
      Object.hasOwn(members ?? {}, step.action.key) &&
        typeof members[step.action.key]?.perform === "function",
      `Flow ${flow.name} references a missing or noncallable registered ${step.isTrigger ? "trigger" : "action"}`,
    );
  }
}
