import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import spectral from "@prismatic-io/spectral";

const { testing } = spectral;

import { Ajv } from "ajv";
import AjvDraft04 from "ajv-draft-04";

export type Component = Parameters<typeof testing.createHarness>[0];
export type Input = Component["actions"][string]["inputs"][number];
export type Json = Record<string, unknown>;
type Call = {
  method: string;
  path: string;
  body: Json;
  authorization?: string;
};
export type EditContext = {
  component: Component;
  harness: ReturnType<typeof testing.createHarness>;
  connection: Json;
  calls: Call[];
  subscriptions: Map<string, string>;
  controls: {
    emptyProjects: boolean;
    deleteStatus: number;
    rejectReview: boolean;
  };
};
export type EditCheck = {
  feature: (context: EditContext) => Promise<void>;
};
export const contact = {
  id: "c/1",
  name: "Ada",
  active: false,
  address: { city: "London", country: "GB" },
  tags: ["customer"],
};
export const baselineActions = new Set([
  "getContact",
  "reviewContact",
  "createEmployee",
  "createPerson",
]);
export const object = (value: unknown): Json => {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    "Expected object",
  );
  return value as Json;
};

/** Validate schemas against positive and negative values, not their source spelling. */
export const schemaAccepts = (
  schema: string,
  valid: unknown[],
  invalid: unknown[],
) => {
  const parsed = JSON.parse(schema);
  const dialect = parsed.$schema;
  const options = { strict: false, validateFormats: false };
  const validator =
    typeof dialect === "string" &&
    /json-schema\.org\/draft-04\/schema#?$/.test(dialect)
      ? new AjvDraft04.default(options)
      : new Ajv(options);
  const validate = validator.compile(parsed);
  for (const value of valid)
    assert.ok(
      validate(value),
      `Schema rejects valid data: ${JSON.stringify(validate.errors)}`,
    );
  for (const value of invalid)
    assert.ok(
      !validate(value),
      `Schema accepts invalid data: ${JSON.stringify(value)}`,
    );
};

// Discover declared fields, independently of whether the schema makes them required.
export const schemaPropertyNames = (
  schema: Json,
  root = schema,
  seen = new Set<unknown>(),
): string[] => {
  if (seen.has(schema)) return [];
  seen.add(schema);
  const names = Object.keys(schema.properties ?? {});
  if (typeof schema.$ref === "string") {
    assert.ok(
      schema.$ref.startsWith("#/"),
      "Output schema reference must resolve within its schema",
    );
    const target = schema.$ref
      .slice(2)
      .split("/")
      .reduce<unknown>(
        (value, key) =>
          object(value)[key.replaceAll("~1", "/").replaceAll("~0", "~")],
        root,
      );
    names.push(...schemaPropertyNames(object(target), root, seen));
  }
  for (const composition of [schema.allOf, schema.anyOf, schema.oneOf]) {
    if (Array.isArray(composition))
      for (const member of composition)
        names.push(...schemaPropertyNames(object(member), root, seen));
  }
  return [...new Set(names)];
};

const withApi = async (
  work: (api: {
    connection: Json;
    calls: Call[];
    subscriptions: Map<string, string>;
    controls: {
      emptyProjects: boolean;
      deleteStatus: number;
      rejectReview: boolean;
    };
  }) => Promise<void>,
) => {
  const calls: Call[] = [];
  const subscriptions = new Map<string, string>();
  const controls = {
    emptyProjects: false,
    deleteStatus: 204,
    rejectReview: false,
  };
  let serial = 0;
  const server = createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    const call = {
      method: req.method ?? "",
      path: req.url ?? "",
      body: text ? JSON.parse(text) : {},
      authorization: req.headers.authorization,
    };
    calls.push(call);
    let status = 200;
    let body: unknown;
    if (call.path.endsWith("/review"))
      body = controls.rejectReview
        ? {
            approved: false,
            contactId: "c/1",
            reason: "Missing consent",
            retryable: false,
          }
        : {
            approved: true,
            contactId: "c/1",
            approvedAt: "2026-01-02T03:04:05Z",
          };
    else if (call.path.startsWith("/contacts/")) body = contact;
    else if (call.path === "/projects")
      body = controls.emptyProjects
        ? []
        : [
            { id: "a/b", name: "Same name" },
            { id: "p2", name: "Same name" },
          ];
    else if (call.path === "/subscriptions" && call.method === "POST") {
      const id = `subscription-${++serial}`;
      subscriptions.set(id, String(call.body.endpoint));
      body = { id };
    } else if (
      call.path.startsWith("/subscriptions/") &&
      call.method === "DELETE"
    ) {
      status = controls.deleteStatus;
      const id = decodeURIComponent(call.path.slice("/subscriptions/".length));
      if (status === 204 && !subscriptions.has(id)) status = 404;
      if (status === 204 || status === 404) subscriptions.delete(id);
      body = { message: `Delete ${status}` };
    } else if (call.method === "POST") body = { id: "created", ...call.body };
    else {
      status = 404;
      body = { message: "Unknown API endpoint" };
    }
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(status === 204 ? undefined : JSON.stringify(body));
  });
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await work({
      connection: {
        key: "apiKey",
        configVarKey: "Partner",
        fields: {
          baseUrl: `http://127.0.0.1:${address.port}`,
          apiKey: "oracle-key",
        },
      },
      calls,
      subscriptions,
      controls,
    });
    assert.ok(calls.length > 0, "Feature never called the supplied service");
    for (const call of calls)
      assert.equal(
        call.authorization,
        "Bearer oracle-key",
        "Feature must use the configured connection",
      );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
};

export const child = (inputs: Input[], key: string) => {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z]/g, "");
  const aliases = key === "name" ? ["name", "employeeName"] : [key];
  return inputs.find((input) =>
    aliases.some((alias) =>
      [input.key, input.label].some(
        (value) => normalize(value) === normalize(alias),
      ),
    ),
  );
};
export const fields = (
  inputs: Input[],
  values: Json,
  target: Json = {},
): Json => {
  for (const [key, value] of Object.entries(values)) {
    const located = walkInputs(inputs).find(({ input }) => child([input], key));
    assert.ok(located, `Missing designer field ${key}`);
    setValue(target, located.path, value);
  }
  return target;
};

type LocatedInput = { input: Input; path: string[] };
export const walkInputs = (
  inputs: Input[],
  parent: string[] = [],
): LocatedInput[] =>
  inputs.flatMap((input) => {
    const path = [...parent, input.key];
    return [
      { input, path },
      ...(input.type === "structuredObject"
        ? walkInputs(input.inputs ?? [], path)
        : []),
    ];
  });
export const setValue = (target: Json, path: string[], value: unknown) => {
  let at = target;
  for (const key of path.slice(0, -1)) {
    at[key] ??= {};
    at = object(at[key]);
  }
  at[path[path.length - 1]] = value;
};

/** Trusted feature checks; baseline compatibility is checked separately. */
export const checkCompiledEdit = async (
  component: Component,
  check: EditCheck,
) => {
  const harness = testing.createHarness(component);
  await withApi(async ({ connection, calls, subscriptions, controls }) => {
    await check.feature({
      component,
      harness,
      connection,
      calls,
      subscriptions,
      controls,
    });
    for (const call of calls.filter(({ path }) =>
      ["/employees", "/people", "/companies"].includes(path),
    ))
      assert.equal(call.method, "POST");
  });
};

export const loadEditCheck = async (casePath: string): Promise<EditCheck> => {
  const { check } = (await import(pathToFileURL(resolve(casePath)).href)) as {
    check?: EditCheck;
  };
  assert.ok(
    check && typeof check.feature === "function",
    "Case does not export an edit check",
  );
  return check;
};

export const checkEdit = async (directory: string, casePath: string) => {
  const check = await loadEditCheck(casePath);
  const pkg = JSON.parse(
    await readFile(resolve(directory, "package.json"), "utf8"),
  );
  assert.equal(typeof pkg.main, "string", "Built component needs package.main");
  const loaded = await import(pathToFileURL(resolve(directory, pkg.main)).href);
  const exported = object(loaded.default ?? loaded);
  const component = (exported.default ?? exported) as Component;
  await checkCompiledEdit(component, check);
};
