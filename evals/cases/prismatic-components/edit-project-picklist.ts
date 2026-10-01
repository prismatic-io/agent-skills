import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { EditCheck } from "./_check-edit.ts";
import { object } from "./_check-edit.ts";
import { defineComponentCase } from "./_component-case.ts";

export default defineComponentCase({
  id: "edit-project-picklist",
  service: "Partner Tasks",
  mode: "edit",
  fixture: resolve(import.meta.dirname, "../../fixtures/components/tasks"),
  request:
    "In the embedded workflow builder, customers using our existing Create Task action should choose a project by name rather than find and paste its ID. Use the projects from their connected account. Keep existing integrations that already supply a project ID working. The connector is here and API.md describes the service.",
  persona:
    "You embed Prismatic's workflow builder for customers. They need a dropdown on the action itself, not an integration config wizard. Project names may repeat. No live partner credentials are available; publish a separate copy for review.",
  operations: [
    "Create Task with an account-specific project dropdown on the existing projectId input",
  ],
  preserved: [
    "createTask, its projectId/title/connection inputs, apiKey connection, and ID-based API requests",
  ],
  criteria: [
    {
      id: "embedded-project-data-source",
      criteria:
        "A registered picklist data source fetches GET /projects with the configured connection and returns names as labels and stable IDs as keys. The existing createTask.projectId input references it by its actual registered data-source key so the embedded workflow builder can use it. Existing direct ID values still work. Duplicate names retain separate ID options; an empty list produces an empty picklist. A config-wizard-only example or hardcoded project model is insufficient.",
    },
  ],
  tests: [
    "the registered data source uses the provided credentials",
    "project names map to stable ID values and an empty response gives no options; equivalent meaningful identity-mapping tests are sufficient without a particular duplicate-name fixture",
    "selecting an ID still creates a task for that project",
  ],
  tags: ["edit", "data-source", "embedded-workflow-builder"],
});

export const check: EditCheck = {
  kind: "actions",
  member: () => "createTask",
  feature: async ({ component, harness, connection, calls, controls }) => {
    const input = component.actions.createTask.inputs.find(
      ({ key }) => key === "projectId",
    );
    assert.ok(input?.dataSource, "Project input lacks a data source reference");
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
  },
};
