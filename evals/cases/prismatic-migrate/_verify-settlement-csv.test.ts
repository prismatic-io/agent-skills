import assert from "node:assert/strict";
import { flow, integration } from "@prismatic-io/spectral";
import { test } from "vitest";
import { parse, stringify } from "yaml";
import {
  sourceResult,
  UnsupportedInterface,
  verifyRegisteredCsv,
} from "./_verify-settlement-csv.mjs";

const adapter = {
  flowStableKey: "finance-convert",
  acceptedField: "accepted",
  rejectedField: "rejected",
};
// Harness positive control wraps the executable source in real Spectral registration.
// Deliberate mutations prove independence from subject tests and internal code layout.
const registered = (
  mutate: (
    result: { accepted: string; rejected: string },
    csv: string,
  ) => void = () => {},
  mapped = false,
  triggerBodyField: "body" | "rawBody" = "body",
) =>
  integration({
    name: "Finance checker control",
    flows: [
      flow({
        name: "Conversion",
        stableKey: adapter.flowStableKey,
        onExecution: async (_context, params) => {
          const body = params.onTrigger.results[triggerBodyField].data;
          const csv = mapped
            ? (body as { fileContents: string }).fileContents
            : (body as string);
          const result = sourceResult(csv);
          if (result.error) throw new Error(result.error);
          mutate(result, csv);
          return {
            data: mapped
              ? {
                  posted: result.accepted
                    .split("\n")
                    .filter(Boolean)
                    .map((line: string) => JSON.parse(line)),
                  failures: result.rejected,
                }
              : result,
          };
        },
      }),
    ],
  });

test("registered action with source behavior passes differential check", async () => {
  assert.equal((await verifyRegisteredCsv(registered(), adapter)).passed, true);
});

test("reviewer adapter allows JSON wrapper and alternative output fields and record arrays", async () => {
  assert.equal(
    (
      await verifyRegisteredCsv(registered(undefined, true), {
        ...adapter,
        inputField: "fileContents",
        acceptedField: "posted",
        rejectedField: "failures",
      })
    ).passed,
    true,
  );
});

test("reject wording is not treated as a migration failure", async () => {
  const component = registered((result) => {
    result.rejected = result.rejected
      .split("\n")
      .filter(Boolean)
      .map((line) =>
        JSON.stringify({
          ...JSON.parse(line),
          error: "Review this invalid record",
        }),
      )
      .join("\n");
  });
  assert.equal((await verifyRegisteredCsv(component, adapter)).passed, true);
});

test("narrower decimal acceptance is caught independently", async () => {
  const component = registered((result, csv) => {
    if (csv.includes("+1.25")) result.accepted = "";
  });
  const result = await verifyRegisteredCsv(component, adapter);
  assert.equal(result.passed, false);
  assert.match(result.failures[0].scenario, /decimal spellings/);
});

test("lossy large money conversion fails", async () => {
  const component = registered((result) => {
    result.accepted = result.accepted.replace(
      "9007199254740993",
      "9007199254740992",
    );
  });
  assert.equal((await verifyRegisteredCsv(component, adapter)).passed, false);
});

test("logical indexes cannot replace physical CSV line numbers", async () => {
  const component = registered((result) => {
    result.rejected = result.rejected
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.stringify({ ...JSON.parse(line), endingLine: 1 }))
      .join("\n");
  });
  assert.equal((await verifyRegisteredCsv(component, adapter)).passed, false);
});

test("missing header success fails even when ordinary conversions match", async () => {
  const component = integration({
    name: "Invalid converter",
    flows: [
      flow({
        name: "Conversion",
        stableKey: adapter.flowStableKey,
        onExecution: async (_context, params) => {
          const result = sourceResult(
            params.onTrigger.results.body.data as string,
          );
          return {
            data: result.error ? { accepted: "", rejected: "" } : result,
          };
        },
      }),
    ],
  });
  assert.equal(
    (await verifyRegisteredCsv(component, adapter)).failures.length,
    2,
  );
});

test("missing adapter and unknown flow are unsupported instead of behavioral failures", async () => {
  await assert.rejects(
    () => verifyRegisteredCsv(registered(), {}),
    UnsupportedInterface,
  );
  await assert.rejects(
    () =>
      verifyRegisteredCsv(registered(), {
        ...adapter,
        flowStableKey: "unknown",
      }),
    UnsupportedInterface,
  );
});

test("explicit failed conversion response is a valid abort", async () => {
  const component = integration({
    name: "Explicit failure control",
    flows: [
      flow({
        name: "Conversion",
        stableKey: adapter.flowStableKey,
        onExecution: async (_context, params) => {
          const result = sourceResult(
            params.onTrigger.results.body.data as string,
          );
          return result.error
            ? { statusCode: 422, data: { error: result.error } }
            : { data: result };
        },
      }),
    ],
  });
  assert.equal((await verifyRegisteredCsv(component, adapter)).passed, true);
});

test("numeric alphabet narrowing and blank-line records are detected", async () => {
  for (const marker of ["1_000.00", "١.٢٥", "１２.５０", "\n\n001"]) {
    const component = registered((result, csv) => {
      if (csv.includes(marker)) result.accepted = "";
    });
    const result = await verifyRegisteredCsv(component, adapter);
    assert.equal(result.passed, false, marker);
  }
});

test("ambiguous actions and unexercised local triggers are unsupported", async () => {
  for (const mode of ["multiple-actions", "local-trigger"]) {
    const component = registered();
    assert.ok(component.codeNativeIntegrationYAML);
    const definition = parse(component.codeNativeIntegrationYAML);
    const steps = definition.flows[0].steps;
    const action = steps.find(
      (step: { isTrigger?: boolean }) => !step.isTrigger,
    );
    if (mode === "multiple-actions")
      steps.push({ ...action, name: "Later action" });
    else {
      const trigger = steps.find(
        (step: { isTrigger?: boolean }) => step.isTrigger,
      );
      trigger.action.component.key = component.key;
    }
    await assert.rejects(
      () =>
        verifyRegisteredCsv(
          { ...component, codeNativeIntegrationYAML: stringify(definition) },
          adapter,
        ),
      UnsupportedInterface,
    );
  }
});

test("reviewer adapter can invoke a flow reading the raw webhook body", async () => {
  const result = await verifyRegisteredCsv(
    registered(undefined, false, "rawBody"),
    { ...adapter, triggerBodyField: "rawBody" },
  );
  assert.equal(result.passed, true);
});
