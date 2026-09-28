import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  configPage,
  configVar,
  connectionConfigVar,
  flow,
  integration,
  OAuth2Type,
} from "@prismatic-io/spectral";
import { test } from "vitest";
import { parse, stringify } from "yaml";

const helper = new URL("./_inspect-cni-registration.mjs", import.meta.url);
const { summarizeRegistration } = await import(helper.href);

// Same real-Spectral positive control as existing verify-generated-cni.test.ts.
const basic = () =>
  integration({
    name: "Order transfer",
    description: "Verifier fixture",
    flows: [
      flow({
        name: "Transfer orders",
        stableKey: "orders",
        onExecution: async () => ({ data: null }),
      }),
    ],
  });
test("existing registered CNI positive control; no inferred options/state", () => {
  const result = summarizeRegistration(basic());
  assert.equal(result.flows.length, 1);
  assert.deepEqual(result.flows[0].declaredOptions, {});
  assert.equal(result.flows[0].queueConfig, undefined);
  assert.equal(result.flows[0].triggers[0].componentScope, "referenced");
});
test("existing detached helper and missing executable controls remain rejected", () => {
  assert.throws(
    () => summarizeRegistration({ transform: (x: unknown) => x }),
    /registered/,
  );
  const component = basic();
  component.actions = {};
  assert.throws(() => summarizeRegistration(component), /execution/);
});
test("explicit local OAuth, inline trigger, FIFO and sync declarations survive without values", () => {
  const marker = "SENTINEL_DO_NOT_PRINT";
  const component = integration({
    name: "Evidence control",
    description: marker,
    configPages: {
      Settings: configPage({
        elements: {
          OAuth: connectionConfigVar({
            stableKey: "oauth",
            dataType: "connection",
            oauth2Type: OAuth2Type.AuthorizationCode,
            inputs: {
              authorizeUrl: { label: marker, type: "string", default: marker },
              tokenUrl: { label: marker, type: "string", default: marker },
              scopes: { label: marker, type: "string", default: marker },
              clientId: { label: marker, type: "string", default: marker },
              clientSecret: {
                label: marker,
                type: "password",
                required: true,
                default: marker,
              },
            },
          }),
          Generic: connectionConfigVar({
            stableKey: "generic",
            dataType: "connection",
            inputs: {
              token: { label: marker, type: "password", default: marker },
            },
          }),
          Plain: configVar({
            stableKey: "plain",
            dataType: "string",
            defaultValue: marker,
            description: marker,
          }),
        },
      }),
    },
    flows: [
      flow({
        name: "Control",
        stableKey: "control",
        isSynchronous: true,
        queueConfig: { usesFifoQueue: true, dedupeIdField: marker },
        onTrigger: async (_c, p) => ({ payload: p }),
        onExecution: async () => ({ data: marker }),
      }),
    ],
  });
  const result = summarizeRegistration(component);
  assert.equal(
    result.localConnections[0].oauthDeclaration.oauth2Type,
    "authorization_code",
  );
  assert.deepEqual(result.localConnections[1].oauthDeclaration, {});
  assert.equal(result.flows[0].declaredOptions.isSynchronous, true);
  assert.equal(result.flows[0].queueConfig.usesFifoQueue, true);
  assert.equal(result.flows[0].triggers[0].componentScope, "local");
  assert.equal(result.flows[0].triggers[0].executable, true);
  assert.equal(JSON.stringify(result).includes(marker), false);
});

test("config references and user ownership fields are omissions, not inferred verdicts", () => {
  const component = basic();
  const definition = parse(component.codeNativeIntegrationYAML ?? "");
  definition.requiredConfigVars = [
    {
      key: "External",
      dataType: "connection",
      connection: {
        key: "externalConnection",
        component: { key: "remote", isPublic: true },
      },
      inputs: { token: { type: "configVar", value: "SECRET_DESTINATION" } },
      userLevel: true,
      scopedConfigVar: "SECRET_SCOPE",
      defaultValue: "SECRET_DEFAULT",
    },
  ];
  const result = summarizeRegistration({
    ...component,
    codeNativeIntegrationYAML: stringify(definition),
  });
  assert.equal(
    result.configBindings[0].connection.componentScope,
    "referenced",
  );
  assert.deepEqual(result.configBindings[0].inputBindings, [
    { key: "token", kind: "configVar" },
  ]);
  assert.equal(
    result.evidenceLimits.userLevelAndScopedConnectionRelationships,
    "omitted",
  );
  assert.equal(
    result.evidenceLimits.configVariableBindingDestinations,
    "omitted",
  );
  assert.equal(result.evidenceLimits.hostedBehaviorVerified, false);
  assert.equal(JSON.stringify(result).includes("SECRET_"), false);
  assert.equal("passed" in result, false);
});

test("malformed projected scalar fields cannot leak nested defaults or secrets", () => {
  for (const mutation of ["connection", "option", "binding"]) {
    const component = basic();
    const definition = parse(component.codeNativeIntegrationYAML ?? "");
    const nested = { secret: "DO_NOT_EXPOSE" };
    let connections = component.connections;
    if (mutation === "connection")
      connections = [
        { key: "bad", oauth2Type: nested },
      ] as unknown as typeof connections;
    if (mutation === "option") definition.flows[0].isSynchronous = nested;
    if (mutation === "binding")
      definition.requiredConfigVars = [
        { key: "bad", inputs: { token: { type: nested } } },
      ];
    assert.throws(
      () =>
        summarizeRegistration({
          ...component,
          connections,
          codeNativeIntegrationYAML: stringify(definition),
        }),
      (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Unsupported registration metadata shape/);
        assert.equal(error.message.includes("DO_NOT_EXPOSE"), false);
        return true;
      },
    );
  }
});

test("invalid YAML and code-native markers do not echo configuration values", () => {
  for (const yaml of [
    "value: [DO_NOT_EXPOSE",
    "isCodeNative: { secret: DO_NOT_EXPOSE }",
  ]) {
    assert.throws(
      () =>
        summarizeRegistration({ ...basic(), codeNativeIntegrationYAML: yaml }),
      (error) => {
        assert.ok(error instanceof Error);
        assert.equal(String(error).includes("DO_NOT_EXPOSE"), false);
        assert.equal(JSON.stringify(error).includes("DO_NOT_EXPOSE"), false);
        return true;
      },
    );
  }
});

test("manual CLI reads a disposable compiled project without requiring OAuth", async () => {
  const directory = await mkdtemp(join(tmpdir(), "registration-evidence-"));
  try {
    const spectral = createRequire(import.meta.url).resolve(
      "@prismatic-io/spectral",
    );
    await mkdir(join(directory, "dist"));
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({ private: true }),
    );
    await writeFile(
      join(directory, "dist/index.js"),
      `const {integration,flow}=require(${JSON.stringify(spectral)}); module.exports=integration({name:'Control',flows:[flow({name:'Flow',stableKey:'flow',onExecution:async()=>({data:null})})]});`,
    );
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(helper), directory],
      { encoding: "utf8", timeout: 15000 },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const evidence = JSON.parse(result.stdout);
    assert.equal(evidence.flows.length, 1);
    assert.deepEqual(evidence.localConnections, []);
    assert.equal(
      evidence.evidenceLimits.buildFreshness,
      "caller-established-not-checked",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
