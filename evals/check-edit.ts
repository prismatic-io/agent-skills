import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import spectral from "@prismatic-io/spectral";

const { testing } = spectral;

import { Ajv } from "ajv";
import AjvDraft04 from "ajv-draft-04";

type Component = Parameters<typeof testing.createHarness>[0];
type Input = Component["actions"][string]["inputs"][number];
type Json = Record<string, unknown>;
type Call = {
  method: string;
  path: string;
  body: Json;
  authorization?: string;
};
const contact = {
  id: "c/1",
  name: "Ada",
  active: false,
  address: { city: "London", country: "GB" },
  tags: ["customer"],
};
const baselineActions = new Set([
  "getContact",
  "reviewContact",
  "createEmployee",
  "createPerson",
]);
const object = (value: unknown): Json => {
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
const schemaPropertyNames = (
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

const child = (inputs: Input[], key: string) => {
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
const fields = (inputs: Input[], values: Json, target: Json = {}): Json => {
  for (const [key, value] of Object.entries(values)) {
    const located = walkInputs(inputs).find(({ input }) => child([input], key));
    assert.ok(located, `Missing designer field ${key}`);
    setValue(target, located.path, value);
  }
  return target;
};

type LocatedInput = { input: Input; path: string[] };
const walkInputs = (inputs: Input[], parent: string[] = []): LocatedInput[] =>
  inputs.flatMap((input) => {
    const path = [...parent, input.key];
    return [
      { input, path },
      ...(input.type === "structuredObject"
        ? walkInputs(input.inputs ?? [], path)
        : []),
    ];
  });
const setValue = (target: Json, path: string[], value: unknown) => {
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
  caseId: string,
) => {
  const harness = testing.createHarness(component);
  await withApi(async ({ connection, calls, subscriptions, controls }) => {
    if (caseId === "edit-output-schema") {
      const schema = component.actions.getContact.outputSchema;
      assert.equal(
        schema?.type,
        "actionOutput",
        "Missing registered action output schema",
      );
      assert.ok(schema?.type === "actionOutput");
      schemaAccepts(
        schema.schema,
        [contact, { ...contact, email: "ada@example.test" }],
        [
          { data: contact },
          { ...contact, active: "false" },
          { ...contact, tags: [1] },
          { ...contact, email: 2 },
          { ...contact, id: 2 },
          { ...contact, name: false },
          { ...contact, address: { city: 2, country: "GB" } },
          { ...contact, address: { city: "London", country: false } },
        ],
      );
      assert.deepEqual(
        object(
          await harness.action("getContact", { connection, contactId: "c/1" }),
        ).data,
        contact,
      );
      assert.equal(calls[0].path, "/contacts/c%2F1");
    } else if (caseId === "edit-branch-schemas") {
      const action = component.actions.reviewContact;
      assert.deepEqual([...(action.staticBranchNames ?? [])].sort(), [
        "Approved",
        "Rejected",
      ]);
      const schema = action.outputSchema;
      assert.ok(
        schema?.type === "branchingOutput",
        "Missing branch output schemas",
      );
      assert.deepEqual(schema.branchSchemas.map(({ name }) => name).sort(), [
        "Approved",
        "Rejected",
      ]);
      const approved = { contactId: "c/1", approvedAt: "2026-01-02T03:04:05Z" };
      const rejected = {
        contactId: "c/1",
        reason: "Missing consent",
        retryable: false,
      };
      for (const [name, valid] of [
        ["Approved", approved],
        ["Rejected", rejected],
      ] as const) {
        const branch: { name: string; schema: string } | undefined =
          schema.branchSchemas.find((entry) => entry.name === name);
        assert.ok(branch);
        assert.deepEqual(
          schemaPropertyNames(object(JSON.parse(branch.schema))).sort(),
          Object.keys(valid).sort(),
          "Branch must expose its own data fields, without a result wrapper or the other branch's fields",
        );
        schemaAccepts(
          branch.schema,
          [valid],
          [
            { ...valid, contactId: 1 },
            name === "Rejected"
              ? { ...valid, retryable: "false" }
              : { ...valid, approvedAt: 1 },
            ...(name === "Rejected" ? [{ ...valid, reason: 1 }] : []),
          ],
        );
        controls.rejectReview = name === "Rejected";
        const result = object(
          await harness.action("reviewContact", {
            connection,
            contactId: "c/1",
          }),
        );
        assert.equal(result.branch, name);
        assert.deepEqual(result.data, valid);
      }
    } else if (caseId === "edit-structured-input") {
      const added = Object.entries(component.actions).filter(
        ([key]) => !baselineActions.has(key),
      );
      const match = added.find(([, action]) =>
        walkInputs(action.inputs).some(
          ({ input }) =>
            input.type === "structuredObject" &&
            child(input.inputs ?? [], "street"),
        ),
      );
      assert.ok(match, "No added action exposes a structured address");
      const [key, action] = match;
      const inputs = walkInputs(action.inputs);
      const address = inputs.find(
        ({ input }) =>
          input.type === "structuredObject" &&
          child(input.inputs ?? [], "street"),
      );
      const name = inputs.find(({ input }) => child([input], "name"));
      const externalId = inputs.find(({ input }) =>
        child([input], "externalId"),
      );
      assert.ok(
        address && name && externalId,
        "Missing address, name, or optional external ID fields",
      );
      const addressValue = {
        street: "1 Main St",
        city: "London",
        country: "GB",
      };
      for (const supplied of [true, false]) {
        const params: Json = { connection };
        setValue(params, name.path, "Ada");
        setValue(
          params,
          address.path,
          fields(address.input.inputs ?? [], addressValue),
        );
        if (supplied) setValue(params, externalId.path, "external-1");
        const expected = {
          name: "Ada",
          address: addressValue,
          ...(supplied ? { metadata: { externalId: "external-1" } } : {}),
        };
        const result = object(await harness.action(key, params));
        assert.deepEqual(calls.at(-1)?.body, expected);
        assert.equal(calls.at(-1)?.path, "/employees");
        assert.deepEqual(result.data, { id: "created", ...expected });
      }
    } else if (caseId === "edit-dynamic-input") {
      const added = Object.entries(component.actions).filter(
        ([key]) => !baselineActions.has(key),
      );
      const match = added.find(([, action]) =>
        action.inputs.some((input) => input.type === "dynamicObject"),
      );
      assert.ok(match, "No added action exposes a dynamic object input");
      const [key, action] = match;
      const input = action.inputs.find(
        (entry) => entry.type === "dynamicObject",
      );
      assert.ok(input);
      for (const [kind, expected, endpoint] of [
        [
          "Person",
          { firstName: "Ada", lastName: "Lovelace", email: "ada@example.test" },
          "/people",
        ],
        [
          "Company",
          {
            companyName: "Analytical Engines",
            website: "https://example.test",
          },
          "/companies",
        ],
      ] as const) {
        const configuration: Input | undefined = input.inputs?.find(
          (entry) =>
            entry.key.toLowerCase() === kind.toLowerCase() ||
            entry.label.toLowerCase() === kind.toLowerCase(),
        );
        assert.ok(configuration, `Missing ${kind} configuration`);
        const values = fields(configuration.inputs ?? [], expected);
        const result: Json = object(
          await harness.action(key, {
            connection,
            [input.key]: {
              configuration: configuration.key,
              values,
            },
          }),
        );
        assert.equal(calls.at(-1)?.path, endpoint);
        assert.deepEqual(calls.at(-1)?.body, expected);
        assert.deepEqual(result.data, { id: "created", ...expected });
      }
    } else if (caseId === "edit-project-picklist") {
      const input = component.actions.createTask.inputs.find(
        ({ key }) => key === "projectId",
      );
      assert.ok(
        input?.dataSource,
        "Project input lacks a data source reference",
      );
      assert.equal(
        component.dataSources[input.dataSource]?.dataSourceType,
        "picklist",
      );
      const first = await harness.dataSource(input.dataSource, { connection });
      assert.ok(Array.isArray(first.result));
      assert.deepEqual(
        [...first.result].sort((a, b) =>
          String(object(a).key).localeCompare(String(object(b).key)),
        ),
        [
          { key: "a/b", label: "Same name" },
          { key: "p2", label: "Same name" },
        ],
      );
      assert.equal(calls.at(-1)?.path, "/projects");
      controls.emptyProjects = true;
      assert.deepEqual(
        (await harness.dataSource(input.dataSource, { connection })).result,
        [],
      );
      await harness.action("createTask", {
        connection,
        projectId: "a/b",
        title: "New task",
      });
      assert.equal(calls.at(-1)?.path, "/projects/a%2Fb/tasks");
      assert.deepEqual(calls.at(-1)?.body, { title: "New task" });
    } else if (caseId === "edit-webhook-listening") {
      const trigger = component.triggers.contactChanged;
      const create =
        trigger.webhookCreate ?? trigger.webhookLifecycleHandlers?.create;
      const remove =
        trigger.webhookDelete ?? trigger.webhookLifecycleHandlers?.delete;
      assert.ok(
        create && remove,
        "Listening Mode requires webhook lifecycle handlers",
      );
      let state: Json = {};
      const revisions = new Map<string, number>();
      const invoke = async (
        handler: typeof create,
        flowId: string,
        endpoint = `https://hooks.example.test/${flowId}`,
      ) => {
        const name = `${flowId} human label`;
        const lifecycle = testing.createHarness({
          ...component,
          triggers: { oracle: { ...trigger, onInstanceDeploy: handler } },
        });
        const result = await lifecycle.triggerOnInstanceDeploy(
          "oracle",
          { connection },
          {
            crossFlowState: state,
            flow: {
              id: `versioned-${flowId}-${revisions.get(flowId) ?? 1}`,
              stableId: flowId,
              name,
            },
            webhookUrls: {
              "Unrelated Flow": "https://hooks.example.test/decoy",
              [name]: endpoint,
            },
          },
        );
        if (result?.crossFlowState)
          state = { ...state, ...result.crossFlowState };
      };
      await invoke(create, "flow-a");
      assert.equal(subscriptions.size, 1);
      assert.deepEqual(
        [...subscriptions.values()],
        ["https://hooks.example.test/flow-a"],
        "Registration used another flow's webhook URL",
      );
      const original = [...subscriptions.keys()][0];
      if (trigger.onInstanceDeploy)
        await invoke(trigger.onInstanceDeploy, "flow-a");
      revisions.set("flow-a", 2);
      await invoke(create, "flow-a");
      assert.equal(
        calls.filter(({ method }) => method === "POST").length,
        1,
        "Repeated create duplicates subscriptions",
      );
      await invoke(create, "flow-b");
      assert.equal(subscriptions.size, 2);
      await invoke(create, "flow-a", "https://hooks.example.test/replacement");
      assert.equal(subscriptions.size, 2);
      assert.ok(
        !subscriptions.has(original),
        "Old endpoint subscription was not removed",
      );
      assert.ok(
        [...subscriptions.values()].includes(
          "https://hooks.example.test/replacement",
        ),
      );
      controls.deleteStatus = 500;
      const beforeFailure = structuredClone(state);
      await assert.rejects(() => invoke(remove, "flow-a"));
      assert.deepEqual(
        state,
        beforeFailure,
        "Failed deletion discarded retry state",
      );
      controls.deleteStatus = 204;
      await invoke(remove, "flow-a");
      assert.deepEqual(
        [...subscriptions.values()],
        ["https://hooks.example.test/flow-b"],
      );
      await invoke(remove, "flow-a");
      controls.deleteStatus = 404;
      await invoke(remove, "flow-b");
      await invoke(remove, "flow-b");
      assert.equal(subscriptions.size, 0);
      for (const call of calls.filter(({ method }) => method === "POST"))
        assert.equal(call.body.event, "contact.changed");
    } else throw new Error(`Unknown edit case ${caseId}`);
    for (const call of calls.filter(({ path }) =>
      ["/employees", "/people", "/companies"].includes(path),
    ))
      assert.equal(call.method, "POST");
  });
};

export const checkEdit = async (directory: string, caseId: string) => {
  const pkg = JSON.parse(
    await readFile(resolve(directory, "package.json"), "utf8"),
  );
  assert.equal(typeof pkg.main, "string", "Built component needs package.main");
  const loaded = await import(pathToFileURL(resolve(directory, pkg.main)).href);
  const exported = object(loaded.default ?? loaded);
  const component = (exported.default ?? exported) as Component;
  await checkCompiledEdit(component, caseId);
  const kind = caseId === "edit-webhook-listening" ? "triggers" : "actions";
  const memberKey =
    caseId === "edit-output-schema"
      ? "getContact"
      : caseId === "edit-branch-schemas"
        ? "reviewContact"
        : caseId === "edit-project-picklist"
          ? "createTask"
          : caseId === "edit-webhook-listening"
            ? "contactChanged"
            : Object.entries(component.actions).find(
                ([key, action]) =>
                  !baselineActions.has(key) &&
                  action.inputs.some(
                    ({ type }) =>
                      type ===
                      (caseId === "edit-dynamic-input"
                        ? "dynamicObject"
                        : "structuredObject"),
                  ),
              )?.[0];
  assert.ok(memberKey);
  const command = spawnSync(
    "prism",
    [
      "components",
      kind,
      "get",
      component.key,
      memberKey,
      "--private",
      "--format",
      "json",
    ],
    { cwd: directory, encoding: "utf8", timeout: 60_000 },
  );
  assert.ifError(command.error);
  assert.equal(
    command.status,
    0,
    `Published member inspection failed: ${command.stderr}\n${command.stdout}`,
  );
  const published = object(JSON.parse(command.stdout));
  if (kind === "triggers") {
    assert.equal(
      published.hasWebhookCreateFunction,
      true,
      "Published trigger lacks create lifecycle",
    );
    assert.equal(
      published.hasWebhookDeleteFunction,
      true,
      "Published trigger lacks delete lifecycle",
    );
  } else {
    const action = component.actions[memberKey];
    if (action.outputSchema) {
      const actual = object(published.outputSchema);
      assert.equal(actual.type, action.outputSchema.type);
      if (action.outputSchema.type === "actionOutput")
        assert.deepEqual(
          JSON.parse(String(actual.schema)),
          JSON.parse(action.outputSchema.schema),
        );
      else {
        assert.ok(Array.isArray(actual.branchSchemas));
        const schemas = (entries: unknown[]) =>
          Object.fromEntries(
            entries.map((entry) => {
              const value = object(entry);
              return [String(value.name), JSON.parse(String(value.schema))];
            }),
          );
        assert.deepEqual(
          schemas(actual.branchSchemas),
          schemas(action.outputSchema.branchSchemas),
        );
      }
    }
    assert.ok(Array.isArray(published.inputs));
    const verifyInputs = (local: Input[], remote: unknown[]) => {
      for (const input of local) {
        const found = remote.map(object).find(({ key }) => key === input.key);
        assert.ok(found, `Published input missing ${input.key}`);
        if (input.dataSource)
          assert.equal(object(found.dataSource).key, input.dataSource);
        if (input.inputs?.length) {
          assert.ok(
            Array.isArray(found.inputs),
            `Published nested input missing ${input.key}`,
          );
          verifyInputs(input.inputs, found.inputs);
        }
      }
    };
    verifyInputs(action.inputs, published.inputs);
  }
};
