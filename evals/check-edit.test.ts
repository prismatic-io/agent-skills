import assert from "node:assert/strict";
import type { testing } from "@prismatic-io/spectral";
import { test } from "vitest";
import { checkCompiledEdit, schemaAccepts } from "./check-edit.ts";

type Component = Parameters<typeof testing.createHarness>[0];
type Json = Record<string, unknown>;
type Connection = { fields: { baseUrl: string; apiKey: string } };
const input = (
  key: string,
  type = "string",
  inputs?: ReturnType<typeof leaf>[],
) => ({ key, label: key, type, ...(inputs ? { inputs } : {}) });
const leaf = (key: string) => ({ key, label: key, type: "string" });
const request = async (
  connection: Connection,
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) => {
  const result = await fetch(`${connection.fields.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${connection.fields.apiKey}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!result.ok && result.status !== 404)
    throw new Error(`API ${result.status}`);
  return result.status === 204 || result.status === 404
    ? undefined
    : result.json();
};
const objectSchema = (
  properties: Json,
  required = Object.keys(properties),
) => ({ type: "object", properties, required });
const string = { type: "string" };
const contactSchema = objectSchema(
  {
    id: string,
    name: string,
    active: { type: "boolean" },
    address: objectSchema({ city: string, country: string }),
    tags: { type: "array", items: string },
    email: string,
  },
  ["id", "name", "active", "address", "tags"],
);
const approvedSchema = objectSchema({ contactId: string, approvedAt: string });
const rejectedSchema = objectSchema({
  contactId: string,
  reason: string,
  retryable: { type: "boolean" },
});

const goodComponent = (): Component =>
  ({
    key: "oracle-positive",
    actions: {
      getContact: {
        inputs: [input("connection"), input("contactId")],
        outputSchema: {
          type: "actionOutput",
          schema: JSON.stringify(contactSchema),
        },
        perform: async (
          _: unknown,
          params: { connection: Connection; contactId: string },
        ) => ({
          data: await request(
            params.connection,
            `/contacts/${encodeURIComponent(params.contactId)}`,
          ),
        }),
      },
      reviewContact: {
        inputs: [input("connection"), input("contactId")],
        staticBranchNames: ["Approved", "Rejected"],
        outputSchema: {
          type: "branchingOutput",
          branchSchemas: [
            { name: "Approved", schema: JSON.stringify(approvedSchema) },
            { name: "Rejected", schema: JSON.stringify(rejectedSchema) },
          ],
        },
        perform: async (
          _: unknown,
          params: { connection: Connection; contactId: string },
        ) => {
          const value = await request(
            params.connection,
            `/contacts/${encodeURIComponent(params.contactId)}/review`,
          );
          return value.approved
            ? {
                branch: "Approved",
                data: {
                  contactId: value.contactId,
                  approvedAt: value.approvedAt,
                },
              }
            : {
                branch: "Rejected",
                data: {
                  contactId: value.contactId,
                  reason: value.reason,
                  retryable: value.retryable,
                },
              };
        },
      },
      employeeFields: {
        inputs: [
          input("connection"),
          input("name"),
          input("address", "structuredObject", [
            leaf("street"),
            leaf("city"),
            leaf("country"),
          ]),
          input("externalId"),
        ],
        perform: async (
          _: unknown,
          params: {
            connection: Connection;
            name: string;
            address: unknown;
            externalId?: string;
          },
        ) => ({
          data: await request(params.connection, "/employees", {
            name: params.name,
            address: params.address,
            ...(params.externalId
              ? { metadata: { externalId: params.externalId } }
              : {}),
          }),
        }),
      },
      record: {
        inputs: [
          input("connection"),
          input("record", "dynamicObject", [
            input("person", "structuredObject", [
              leaf("firstName"),
              leaf("lastName"),
              leaf("email"),
            ]),
            input("company", "structuredObject", [
              leaf("companyName"),
              leaf("website"),
            ]),
          ]),
        ],
        perform: async (
          _: unknown,
          params: {
            connection: Connection;
            record: { configuration: string; values: Json };
          },
        ) => ({
          data: await request(
            params.connection,
            params.record.configuration === "person" ? "/people" : "/companies",
            Object.fromEntries(
              (params.record.configuration === "person"
                ? ["firstName", "lastName", "email"]
                : ["companyName", "website"]
              ).map((key) => [key, params.record.values[key]]),
            ),
          ),
        }),
      },
      createTask: {
        inputs: [
          input("connection"),
          { ...input("projectId"), dataSource: "projects" },
          input("title"),
        ],
        perform: async (
          _: unknown,
          params: { connection: Connection; projectId: string; title: string },
        ) => ({
          data: await request(
            params.connection,
            `/projects/${encodeURIComponent(params.projectId)}/tasks`,
            { title: params.title },
          ),
        }),
      },
    },
    dataSources: {
      projects: {
        inputs: [input("connection")],
        dataSourceType: "picklist",
        perform: async (_: unknown, params: { connection: Connection }) => ({
          result: (await request(params.connection, "/projects")).map(
            (project: { id: string; name: string }) => ({
              key: project.id,
              label: project.name,
            }),
          ),
        }),
      },
    },
    triggers: {
      contactChanged: {
        inputs: [input("connection")],
        webhookCreate: async (
          context: {
            crossFlowState: Json;
            flow: { stableId: string; name: string };
            webhookUrls: Record<string, string>;
          },
          params: { connection: Connection },
        ) => {
          const key = context.flow.stableId;
          const previous = context.crossFlowState[key] as
            | { id: string; endpoint: string }
            | undefined;
          const endpoint = context.webhookUrls[context.flow.name];
          if (previous?.endpoint === endpoint) return;
          if (previous)
            await request(
              params.connection,
              `/subscriptions/${previous.id}`,
              undefined,
              "DELETE",
            );
          const created = await request(params.connection, "/subscriptions", {
            endpoint,
            event: "contact.changed",
          });
          return { crossFlowState: { [key]: { id: created.id, endpoint } } };
        },
        webhookDelete: async (
          context: { crossFlowState: Json; flow: { stableId: string } },
          params: { connection: Connection },
        ) => {
          const key = context.flow.stableId;
          const previous = context.crossFlowState[key] as
            | { id: string }
            | undefined;
          if (previous)
            await request(
              params.connection,
              `/subscriptions/${previous.id}`,
              undefined,
              "DELETE",
            );
          return { crossFlowState: { [key]: null } };
        },
      },
    },
  }) as unknown as Component;

for (const id of [
  "output-schema",
  "branch-schemas",
  "structured-input",
  "dynamic-input",
  "project-picklist",
  "webhook-listening",
]) {
  test(`trusted oracle accepts correct ${id} behavior`, async () => {
    await checkCompiledEdit(goodComponent(), `edit-${id}`);
  });
}

test("schema oracle rejects permissive, wrapper and incorrect optional-email schemas", () => {
  assert.throws(
    () => schemaAccepts("{}", [{ id: "a" }], [{ id: 1 }]),
    /accepts invalid/,
  );
  assert.throws(
    () =>
      schemaAccepts(
        JSON.stringify(objectSchema({ data: contactSchema })),
        [{ id: "a" }],
        [],
      ),
    /rejects valid/,
  );
  assert.throws(
    () =>
      schemaAccepts(
        JSON.stringify({
          ...contactSchema,
          required: [...contactSchema.required, "email"],
        }),
        [
          {
            id: "a",
            name: "A",
            active: true,
            address: { city: "C", country: "GB" },
            tags: [],
          },
        ],
        [],
      ),
    /rejects valid/,
  );
});

test("draft-04 schemas retain their own exclusiveMinimum semantics", () => {
  schemaAccepts(
    JSON.stringify({
      $schema: "http://json-schema.org/draft-04/schema#",
      type: "number",
      minimum: 0,
      exclusiveMinimum: true,
    }),
    [1],
    [0, -1],
  );
});

test("draft-04 contact metadata is accepted without changing its dialect", async () => {
  const component = goodComponent();
  component.actions.getContact.outputSchema = {
    type: "actionOutput",
    schema: JSON.stringify({
      ...contactSchema,
      $schema: "http://json-schema.org/draft-04/schema#",
    }),
  };
  await checkCompiledEdit(component, "edit-output-schema");
});

test("descriptive branch schemas do not need required arrays", async () => {
  const component = goodComponent();
  const output = component.actions.reviewContact.outputSchema;
  assert.ok(output?.type === "branchingOutput");
  for (const branch of output.branchSchemas) {
    const schema = JSON.parse(branch.schema);
    delete schema.required;
    branch.schema = JSON.stringify(schema);
  }
  await checkCompiledEdit(component, "edit-branch-schemas");
});

test("descriptive branch metadata still rejects union fields and result wrappers", async () => {
  for (const properties of [
    { ...approvedSchema.properties, ...rejectedSchema.properties },
    { branch: string, data: approvedSchema },
  ]) {
    const component = goodComponent();
    const output = component.actions.reviewContact.outputSchema;
    assert.ok(output?.type === "branchingOutput");
    output.branchSchemas[0].schema = JSON.stringify({
      type: "object",
      properties,
    });
    await assert.rejects(
      () => checkCompiledEdit(component, "edit-branch-schemas"),
      /own data fields/,
    );
  }
});

test("descriptive branch metadata must preserve field types", async () => {
  const component = goodComponent();
  const output = component.actions.reviewContact.outputSchema;
  assert.ok(output?.type === "branchingOutput");
  output.branchSchemas[1].schema = JSON.stringify({
    type: "object",
    properties: { ...rejectedSchema.properties, retryable: {} },
  });
  await assert.rejects(
    () => checkCompiledEdit(component, "edit-branch-schemas"),
    /accepts invalid/,
  );
});

test("structured fields may be grouped under an employee input", async () => {
  const component = goodComponent();
  const action = component.actions.employeeFields;
  const original = action.perform;
  action.inputs = [
    input("connection"),
    {
      key: "employee",
      label: "Employee",
      type: "structuredObject",
      inputs: action.inputs.filter(({ key }) => key !== "connection"),
    },
  ];
  action.perform = async (context, params) =>
    original(context, {
      connection: params.connection,
      ...(params.employee as Json),
    });
  await checkCompiledEdit(component, "edit-structured-input");
});

test("structured employee fields may use descriptive names", async () => {
  const component = goodComponent();
  const action = component.actions.employeeFields;
  const original = action.perform;
  const name = action.inputs.find(({ key }) => key === "name");
  assert.ok(name);
  name.key = "employeeName";
  name.label = "Employee Name";
  action.perform = (context, params) =>
    original(context, { ...params, name: params.employeeName });
  await checkCompiledEdit(component, "edit-structured-input");
});

test("structured metadata is bound by behavior rather than a new input key", async () => {
  const component = goodComponent();
  const action = component.actions.employeeFields;
  const original = action.perform;
  const externalId = action.inputs.find(({ key }) => key === "externalId");
  assert.ok(externalId);
  externalId.key = "partnerReference";
  externalId.label = "Metadata External ID";
  action.inputs.unshift(input("unrelatedOptionalNote"));
  action.perform = (context, params) =>
    original(context, { ...params, externalId: params.partnerReference });
  await checkCompiledEdit(component, "edit-structured-input");
});

test("a correctly named but ignored metadata input is rejected", async () => {
  const component = goodComponent();
  const action = component.actions.employeeFields;
  const original = action.perform;
  action.perform = (context, params) =>
    original(context, { ...params, externalId: undefined });
  await assert.rejects(
    () => checkCompiledEdit(component, "edit-structured-input"),
    /No optional designer input/,
  );
});

test("metadata must preserve the supplied identifier rather than a fixed value", async () => {
  const component = goodComponent();
  const action = component.actions.employeeFields;
  const original = action.perform;
  action.perform = (context, params) =>
    original(context, {
      ...params,
      externalId: params.externalId ? "external-1" : undefined,
    });
  await assert.rejects(
    () => checkCompiledEdit(component, "edit-structured-input"),
    /No optional designer input/,
  );
});

test("metadata must remain absent when its input is omitted", async () => {
  const component = goodComponent();
  const action = component.actions.employeeFields;
  const original = action.perform;
  action.perform = (context, params) =>
    original(context, {
      ...params,
      externalId: params.externalId || "unrequested-default",
    });
  await assert.rejects(
    () => checkCompiledEdit(component, "edit-structured-input"),
    /No optional designer input/,
  );
});

test("metadata external ID must not be a required designer input", async () => {
  const component = goodComponent();
  const externalId = component.actions.employeeFields.inputs.find(
    ({ key }) => key === "externalId",
  );
  assert.ok(externalId);
  externalId.required = true;
  await assert.rejects(
    () => checkCompiledEdit(component, "edit-structured-input"),
    /No optional designer input/,
  );
});

test("a correct final employee request does not hide duplicate creation", async () => {
  const component = goodComponent();
  const action = component.actions.employeeFields;
  const original = action.perform;
  action.perform = async (context, params) => {
    await original(context, params);
    return original(context, params);
  };
  await assert.rejects(
    () => checkCompiledEdit(component, "edit-structured-input"),
    /Expected exactly one creation write/,
  );
});

test("dynamic configuration fields may use supported structured groups", async () => {
  const component = goodComponent();
  const action = component.actions.record;
  const original = action.perform;
  const configurations = action.inputs.find(
    ({ key }) => key === "record",
  )?.inputs;
  assert.ok(configurations);
  for (const configuration of configurations)
    configuration.inputs = [
      {
        key: "details",
        label: "Details",
        type: "structuredObject",
        inputs: configuration.inputs,
      },
    ];
  action.perform = (context, params) => {
    const record = params.record as {
      configuration: string;
      values: { details: Json };
    };
    return original(context, {
      ...params,
      record: {
        configuration: record.configuration,
        values: record.values.details,
      },
    });
  };
  await checkCompiledEdit(component, "edit-dynamic-input");
});

test("dynamic requests cannot forward the configuration wrapper", async () => {
  const component = goodComponent();
  component.actions.record.perform = async (_context, params) => {
    const record = params.record as { configuration: string; values: Json };
    return {
      data: await request(
        params.connection as Connection,
        record.configuration === "person" ? "/people" : "/companies",
        record,
      ),
    };
  };
  await assert.rejects(() =>
    checkCompiledEdit(component, "edit-dynamic-input"),
  );
});

test("dynamic actions may forward valid selected configuration values", async () => {
  const component = goodComponent();
  component.actions.record.perform = async (_context, params) => {
    const record = params.record as { configuration: string; values: Json };
    return {
      data: await request(
        params.connection as Connection,
        record.configuration === "person" ? "/people" : "/companies",
        record.values,
      ),
    };
  };
  await checkCompiledEdit(component, "edit-dynamic-input");
});

test("webhook registration must select its own flow URL", async () => {
  const component = goodComponent();
  const trigger = component.triggers.contactChanged;
  const original = trigger.webhookCreate;
  assert.ok(original);
  trigger.webhookCreate = (context, params) =>
    original(
      {
        ...context,
        webhookUrls: {
          [context.flow.name]: Object.values(context.webhookUrls)[0],
        },
      },
      params,
    );
  await assert.rejects(
    () => checkCompiledEdit(component, "edit-webhook-listening"),
    /another flow/,
  );
});

test("webhook state survives changing version-specific flow IDs", async () => {
  const component = goodComponent();
  const trigger = component.triggers.contactChanged;
  for (const key of ["webhookCreate", "webhookDelete"] as const) {
    const original = trigger[key];
    assert.ok(original);
    trigger[key] = (context, params) =>
      original(
        { ...context, flow: { ...context.flow, stableId: context.flow.id } },
        params,
      );
  }
  await assert.rejects(
    () => checkCompiledEdit(component, "edit-webhook-listening"),
    /duplicates subscriptions/,
  );
});

test("passing code without requested metadata is rejected", async () => {
  const component = goodComponent();
  delete component.actions.getContact.outputSchema;
  await assert.rejects(
    () => checkCompiledEdit(component, "edit-output-schema"),
    /output schema/,
  );
});

test("an unrelated data source cannot substitute for input linkage", async () => {
  const component = goodComponent();
  const project = component.actions.createTask.inputs.find(
    ({ key }) => key === "projectId",
  );
  assert.ok(project);
  delete project.dataSource;
  await assert.rejects(
    () => checkCompiledEdit(component, "edit-project-picklist"),
    /data source reference/,
  );
});

test("correct metadata with a stub dynamic implementation is rejected", async () => {
  const component = goodComponent();
  component.actions.record.perform = async () => ({ data: {} });
  await assert.rejects(() =>
    checkCompiledEdit(component, "edit-dynamic-input"),
  );
});

test("silent wrong token use is rejected independently of subject tests", async () => {
  const component = goodComponent();
  const original = component.actions.getContact.perform;
  component.actions.getContact.perform = async (context, params) => {
    const connection = params.connection as Connection;
    return original(context, {
      ...params,
      connection: {
        ...connection,
        fields: { ...connection.fields, apiKey: "wrong" },
      },
    });
  };
  await assert.rejects(
    () => checkCompiledEdit(component, "edit-output-schema"),
    /configured connection/,
  );
});

test("instance-only lifecycle handlers cannot pass Listening Mode", async () => {
  const component = goodComponent();
  component.triggers.contactChanged.onInstanceDeploy =
    component.triggers.contactChanged.webhookCreate;
  delete component.triggers.contactChanged.webhookCreate;
  await assert.rejects(
    () => checkCompiledEdit(component, "edit-webhook-listening"),
    /Listening Mode/,
  );
});

test("webhook cleanup must survive serialized returned state", async () => {
  const component = goodComponent();
  const trigger = component.triggers.contactChanged;
  const remove = trigger.webhookDelete;
  assert.ok(remove);
  trigger.webhookDelete = async (context, params) => {
    await remove(context, params);
    return { crossFlowState: { [context.flow.stableId]: undefined } };
  };
  await assert.rejects(
    () => checkCompiledEdit(component, "edit-webhook-listening"),
    /stale persisted state/,
  );
});

test("webhook state supports context mutation and direct deletion", async () => {
  const component = goodComponent();
  const trigger = component.triggers.contactChanged;
  for (const key of ["webhookCreate", "webhookDelete"] as const) {
    const handler = trigger[key];
    assert.ok(handler);
    trigger[key] = async (context, params) => {
      const result = await handler(context, params);
      for (const [stateKey, value] of Object.entries(
        result?.crossFlowState ?? {},
      )) {
        if (value === null) delete context.crossFlowState[stateKey];
        else context.crossFlowState[stateKey] = value;
      }
    };
  }
  await checkCompiledEdit(component, "edit-webhook-listening");
});

test("failed webhook cleanup does not commit context mutations", async () => {
  const component = goodComponent();
  const trigger = component.triggers.contactChanged;
  const remove = trigger.webhookDelete;
  assert.ok(remove);
  trigger.webhookDelete = async (context, params) => {
    const snapshot = structuredClone(context.crossFlowState);
    delete context.crossFlowState[context.flow.stableId];
    return remove({ ...context, crossFlowState: snapshot }, params);
  };
  await checkCompiledEdit(component, "edit-webhook-listening");
});
