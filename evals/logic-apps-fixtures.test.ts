import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

test("binary copy takes contents and name from distinct source channels", async () => {
  const template = JSON.parse(
    await readFile(
      new URL(
        "./fixtures/migrations/logic-apps-binary-copy/input/legacy/dropbox-onedrive.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const { actions, triggers } = template.properties.definition;
  assert.equal(actions.Create_file.inputs.body, "@triggerBody()");
  assert.equal(
    actions.Create_file.inputs.queries.name,
    "@{triggerOutputs()['headers']?['x-ms-file-name-encoded']}",
  );
  assert.equal(
    actions.Create_file.inputs.queries.folderPath,
    "/backup from Dropbox",
  );
  assert.equal(triggers.When_a_file_is_created.inputs.queries.folderId, "");
  assert.notEqual(
    actions.Create_file.inputs.host.connection.name,
    triggers.When_a_file_is_created.inputs.host.connection.name,
  );
  assert.deepEqual(
    Object.keys(template.properties.connectionReferences).sort(),
    ["dropbox", "onedrive"],
  );
});

test("settlement branches are mutually exclusive and retain the received lock identity", async () => {
  const template = JSON.parse(
    await readFile(
      new URL(
        "./fixtures/migrations/logic-apps-queue-settlement/input/legacy/service-bus-peek-lock-dead-letter.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const { actions, triggers } = template.properties.definition;
  const complete = actions.Complete_the_message_in_a_queue;
  const deadletter = actions["Dead-letter_the_message_in_a_queue"];
  assert.deepEqual(complete.runAfter, { Scope: ["Succeeded"] });
  assert.deepEqual(deadletter.runAfter, { Scope: ["Failed"] });
  assert.equal(
    complete.inputs.queries.lockToken,
    "@{triggerBody()?['LockToken']}",
  );
  assert.equal(
    deadletter.inputs.queries.lockToken,
    complete.inputs.queries.lockToken,
  );
  assert.equal(Object.values(triggers).length, 1);
  assert.deepEqual(
    triggers["When_a_message_is_received_in_a_queue_(peek-lock)"].recurrence,
    { frequency: "Minute", interval: 3 },
  );
  assert.equal(actions.Scope.actions.HTTP.inputs.method, "GET");
});

test("run-once dependencies distinguish delayed success and all authored error statuses", async () => {
  const template = JSON.parse(
    await readFile(
      new URL(
        "./fixtures/migrations/logic-apps-run-once/input/legacy/scheduler-run-once-http.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const { actions, triggers } = template.properties.definition;
  assert.equal(actions.Delay_until.type, "Wait");
  assert.equal(
    actions.Delay_until.inputs.until.timestamp,
    "@triggerBody()?['startTime']",
  );
  assert.deepEqual(actions.Primary_actions.runAfter, {
    Delay_until: ["Succeeded"],
  });
  assert.deepEqual(actions.Error_actions.runAfter, {
    Primary_actions: ["Failed", "Skipped", "TimedOut"],
  });
  assert.equal(actions.Primary_actions.actions.Call_HTTP.inputs.uri, "");
  assert.equal(actions.Error_actions.actions.Call_HTTP_on_Error.inputs.uri, "");
  assert.equal(triggers.manual.type, "Request");
  assert.equal(triggers.manual.inputs.schema.required, undefined);
});
