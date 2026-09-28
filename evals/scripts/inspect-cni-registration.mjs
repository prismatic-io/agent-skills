import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { resolveCniEntrypoint } from "./cni-entrypoint.mjs";

// Validate shapes only, not platform-supported enum values or runtime validity.
const booleanFields = new Set([
  "isPublic",
  "isPollingTrigger",
  "hasOnInstanceDeploy",
  "hasOnInstanceDelete",
  "hasWebhookCreateFunction",
  "hasWebhookDeleteFunction",
  "isSynchronous",
  "usesFifoQueue",
  "singletonExecutions",
  "required",
]);
const numericFields = new Set(["concurrencyLimit"]);
const stringOrNumberFields = new Set(["version", "definitionVersion"]);
const field = (key, value) => {
  if (value === undefined) return undefined;
  const valid = booleanFields.has(key)
    ? typeof value === "boolean"
    : numericFields.has(key)
      ? typeof value === "number" && Number.isFinite(value)
      : stringOrNumberFields.has(key)
        ? typeof value === "string" ||
          (typeof value === "number" && Number.isFinite(value))
        : typeof value === "string";
  // Do not include a rejected value in errors or serialized output.
  assert.ok(valid, `Unsupported registration metadata shape for ${key}`);
  return value;
};
const pick = (object, keys) =>
  Object.fromEntries(
    keys
      .filter((k) => object?.[k] !== undefined)
      .map((k) => [k, field(k, object[k])]),
  );
const ref = (action) => ({
  key: field("key", action?.key),
  component: pick(action?.component, ["key", "version", "isPublic"]),
});
// Literal values and defaults are never projected. Identifiers remain visible.
const bindings = (inputs) =>
  Object.entries(inputs ?? {}).map(([key, input]) => ({
    key,
    kind: field("type", input?.type) ?? "unspecified",
  }));
export const summarizeRegistration = (component) => {
  assert.equal(
    typeof component?.codeNativeIntegrationYAML,
    "string",
    "Not a registered Spectral CNI",
  );
  let definition;
  try {
    definition = parse(component.codeNativeIntegrationYAML);
  } catch {
    // Parser diagnostics can echo literal configuration values.
    throw new Error("Invalid registered integration YAML");
  }
  assert.ok(definition?.isCodeNative === true, "Not code-native YAML");
  assert.ok(
    typeof component.key === "string" && component.key.length,
    "Missing component key",
  );
  assert.ok(
    Array.isArray(definition.flows) && definition.flows.length,
    "No registered flows",
  );
  const flows = definition.flows.map((flow) => {
    const execution = flow.steps?.find(
      (s) => !s.isTrigger && s.action?.component?.key === component.key,
    );
    assert.ok(
      execution &&
        typeof component.actions?.[execution.action.key]?.perform ===
          "function",
      "Missing registered execution action",
    );
    const triggers = (flow.steps ?? [])
      .filter((s) => s.isTrigger)
      .map((step) => {
        const local = step.action?.component?.key === component.key;
        const declaration = local
          ? component.triggers?.[step.action.key]
          : undefined;
        return {
          action: ref(step.action),
          componentScope: local ? "local" : "referenced",
          ...(local
            ? {
                executable: typeof declaration?.perform === "function",
                declaration: pick(declaration, [
                  "isPollingTrigger",
                  "scheduleSupport",
                  "synchronousResponseSupport",
                  "hasOnInstanceDeploy",
                  "hasOnInstanceDelete",
                  "hasWebhookCreateFunction",
                  "hasWebhookDeleteFunction",
                ]),
              }
            : {}),
          inputBindings: bindings(step.inputs),
          ...(step.schedule
            ? {
                schedule: {
                  kind: field("type", step.schedule.type) ?? "unspecified",
                },
              }
            : {}),
        };
      });
    return {
      stableKey: field("stableKey", flow.stableKey),
      declaredOptions: pick(flow, ["isSynchronous"]),
      ...(flow.queueConfig
        ? {
            queueConfig: {
              ...pick(flow.queueConfig, [
                "usesFifoQueue",
                "singletonExecutions",
                "concurrencyLimit",
              ]),
              dedupeIdBindingPresent:
                flow.queueConfig.dedupeIdField !== undefined,
            },
          }
        : {}),
      triggers,
      executionAction: field("key", execution.action.key),
    };
  });
  return {
    evidenceKind: "local-registration",
    definitionVersion: field("definitionVersion", definition.definitionVersion),
    flows,
    localConnections: (component.connections ?? []).map((connection) => ({
      key: field("key", connection.key),
      oauthDeclaration: pick(connection, ["oauth2Type", "oauth2PkceMethod"]),
      inputs: (connection.inputs ?? []).map((input) =>
        pick(input, ["key", "type", "required"]),
      ),
    })),
    configBindings: (definition.requiredConfigVars ?? []).map((config) => ({
      ...pick(config, ["key", "stableKey", "dataType"]),
      ...(config.connection
        ? {
            connection: {
              ...ref(config.connection),
              componentScope:
                config.connection.component?.key === component.key
                  ? "local"
                  : "referenced",
            },
          }
        : {}),
      inputBindings: bindings(config.inputs),
    })),
    evidenceLimits: {
      hostedBehaviorVerified: false,
      buildFreshness: "caller-established-not-checked",
      configVariableBindingDestinations: "omitted",
      userLevelAndScopedConnectionRelationships: "omitted",
      componentScopeMeaning: "local-versus-referenced-component-only",
      metadataValidation: "field-shapes-only-not-platform-validity",
      identifierSafety: "caller-reviewed-not-secret-detection",
    },
    limits: [
      "Config destinations and user-level/scoped connection relationships are omitted; correct wiring and credential ownership cannot be inferred.",
      "Build freshness requires separate caller evidence; importing a module does not rebuild it.",
      "Declarations only; no hosted execution, credential validity, OAuth handshake, state durability or remote component contract verified.",
      "Absent fields mean absent from this registration, not inferred platform defaults or invalidity.",
      "State usage is not inferable from registration; no state claim is emitted.",
      "Values/defaults omitted; identifiers are retained and must not themselves contain secrets.",
    ],
  };
};
export const inspectBuiltProject = async (directory) => {
  const entrypoint = await resolveCniEntrypoint(directory);
  let component = await import(pathToFileURL(entrypoint).href);
  for (
    let i = 0;
    i < 3 && !component.codeNativeIntegrationYAML && component.default;
    i++
  )
    component = component.default;
  return summarizeRegistration(component);
};
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  console.log(
    JSON.stringify(
      await inspectBuiltProject(resolve(process.argv[2] ?? ".")),
      null,
      2,
    ),
  );
}
