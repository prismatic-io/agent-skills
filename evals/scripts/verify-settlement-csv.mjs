#!/usr/bin/env node

// Reviewer-owned differential check. No subject helper or subject-written test is loaded.
// Adapter JSON: { flowStableKey, inputField?: string, acceptedField, rejectedField }.
// triggerBodyField is body (default) or rawBody, as documented by the delivered flow.
// Omit inputField for a raw CSV trigger body; outputs can be arrays or JSONL strings.
// Exit 2 means the local interface cannot be adapted; it is not evidence of bad behavior.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "yaml";
import { withComponentWorkspace } from "../cases/prismatic-components/_check-component.ts";
import { resolveCniEntrypoint } from "./cni-entrypoint.mjs";

const legacy = fileURLToPath(
  new URL(
    "../fixtures/migrations/bespoke-settlement-csv/input/legacy/import_settlements.py",
    import.meta.url,
  ),
);
const header = "settlement_id,merchant_id,amount,currency,memo\n";
export const samples = [
  {
    name: "CSV quoting, Unicode, physical lines and exact money",
    csv: `\ufeff${header}0001,0072,90071992547409.93,USD,"Payout, café"\n0002,0072,-4.25,EUR,"Refund\nprocessed"\n0003,0072,1.005,EUR,reject\n0004,0072,0,USD,continue\n`,
  },
  {
    name: "source-supported decimal spellings",
    csv: `${header}001,01,+1.25,USD,plus\n002,01, 1.25 ,USD,spaces\n003,01,1e2,EUR,exponent\n004,01,.50,USD,leading decimal\n005,01,-0.00,USD,negative zero\n006,01,1.2300,EUR,trailing zeros\n`,
  },
  {
    name: "reject stream and continued processing",
    csv: `${header}1,02,NaN,USD,nonfinite\n\n2,02,Infinity,EUR,nonfinite\n3,02,1,GBP,currency\n,02,1,USD,identifier\n5,02,bad,EUR,amount\n6,02,2,USD,valid after rejects\n`,
  },
  {
    name: "source numeric alphabet and separators",
    csv: `${header}001,01,1_000.00,USD,separators\n002,01,١.٢٥,EUR,Arabic Indic digits\n003,01,１２.５０,USD,fullwidth digits\n`,
  },
  {
    name: "blank physical lines are skipped",
    csv: `${header}\n001,01,1.00,USD,before\n\n002,01,2.00,EUR,after\n`,
  },
  { name: "missing headers abort", csv: "settlement_id,amount\n01,1.00\n" },
  { name: "empty input aborts", csv: "" },
];

export class UnsupportedInterface extends Error {}

export const sourceResult = (csv) => {
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import importlib.util,io,json,sys
spec=importlib.util.spec_from_file_location("legacy",sys.argv[1]); module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
accepted=io.StringIO(); rejected=io.StringIO()
try:
 module.convert(io.StringIO(sys.stdin.read().removeprefix("\\ufeff"),newline=""),accepted,rejected)
 print(json.dumps({"accepted":accepted.getvalue(),"rejected":rejected.getvalue()}))
except ValueError as error:
 print(json.dumps({"error":str(error)}))`,
      legacy,
    ],
    { input: csv, encoding: "utf8", timeout: 10000 },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

const records = (value) => {
  if (Array.isArray(value)) return value;
  assert.equal(typeof value, "string", "Output must contain records or JSONL");
  return value
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
};
const rejects = (value) =>
  records(value).map(({ endingLine, row, error }) => {
    assert.equal(typeof error, "string", "Reject must include a reason");
    assert.ok(error.trim().length, "Reject reason must not be empty");
    return { endingLine, row }; // Wording is not a parity requirement.
  });

export const verifyRegisteredCsv = async (component, adapter) => {
  if (
    !adapter ||
    !["flowStableKey", "acceptedField", "rejectedField"].every(
      (key) => typeof adapter[key] === "string" && adapter[key].length,
    )
  )
    throw new UnsupportedInterface(
      "Supply a reviewer-approved flow and output-field adapter",
    );
  if (
    adapter.inputField !== undefined &&
    typeof adapter.inputField !== "string"
  )
    throw new UnsupportedInterface("inputField must be a string or omitted");
  const triggerBodyField = adapter.triggerBodyField ?? "body";
  if (!["body", "rawBody"].includes(triggerBodyField))
    throw new UnsupportedInterface("triggerBodyField must be body or rawBody");
  const definition = parse(component.codeNativeIntegrationYAML);
  const flow = definition.flows?.find(
    (item) => item.stableKey === adapter.flowStableKey,
  );
  const steps = flow?.steps?.filter((item) => !item.isTrigger) ?? [];
  const step = steps.length === 1 ? steps[0] : undefined;
  const trigger = flow?.steps?.find((item) => item.isTrigger);
  if (trigger?.action?.component?.key === component.key)
    throw new UnsupportedInterface(
      "Local custom trigger requires a reviewer adapter exercising its transformation",
    );
  if (!step || step.action?.component?.key !== component.key)
    throw new UnsupportedInterface(
      "Selected flow must have one unambiguous registered conversion action",
    );
  const execute = component.actions?.[step?.action?.key]?.perform;
  if (typeof execute !== "function")
    throw new UnsupportedInterface(
      "Selected flow has no directly invocable registered action",
    );
  const failures = [];
  for (const sample of samples) {
    const expected = sourceResult(sample.csv);
    const body =
      adapter.inputField === undefined
        ? sample.csv
        : { [adapter.inputField]: sample.csv };
    const context = {
      configVars: {},
      instanceState: {},
      crossFlowState: {},
      executionState: {},
      integrationState: {},
      globalDebug: false,
      logger: { info() {}, warn() {}, error() {}, debug() {}, metric() {} },
    };
    try {
      if (expected.error) {
        let result;
        let thrown;
        try {
          result = await execute(context, {
            onTrigger: { results: { [triggerBodyField]: { data: body } } },
          });
        } catch (error) {
          thrown = error;
        }
        // A failed callable response is a legitimate conversion abort. This
        // does not prove its hosted HTTP delivery or classify incidental throws.
        const failedResponse =
          Number.isInteger(result?.statusCode) &&
          result.statusCode >= 400 &&
          result.statusCode <= 599 &&
          typeof result?.data?.error === "string" &&
          result.data.error.trim().length > 0;
        assert.ok(
          thrown || failedResponse,
          "Invalid file must throw or explicitly report a failed conversion",
        );
      } else {
        const result = await execute(context, {
          onTrigger: { results: { [triggerBodyField]: { data: body } } },
        });
        assert.deepEqual(
          records(result?.data?.[adapter.acceptedField]),
          records(expected.accepted),
          "Accepted records differ from the legacy converter",
        );
        assert.deepEqual(
          rejects(result?.data?.[adapter.rejectedField]),
          rejects(expected.rejected),
          "Rejected rows or physical line numbers differ from the legacy converter",
        );
      }
    } catch (error) {
      failures.push({ scenario: sample.name, message: error.message });
    }
  }
  return {
    passed: failures.length === 0,
    scenarios: samples.length,
    failures,
    scope:
      "Local registered conversion action; excludes deployed trigger/HTTP response and transport behavior",
  };
};

const main = async () => {
  if (!process.argv[2] || !process.argv[3])
    throw new UnsupportedInterface(
      "Usage: verify-settlement-csv.mjs <CNI project> <reviewer adapter.json>",
    );
  const project = resolve(process.argv[2]);
  const adapter = JSON.parse(await readFile(resolve(process.argv[3]), "utf8"));
  await withComponentWorkspace(project, async (directory) => {
    const build = spawnSync("npm", ["run", "build"], {
      cwd: directory,
      stdio: "inherit",
      timeout: 180000,
    });
    assert.ifError(build.error);
    assert.equal(
      build.status,
      0,
      "Generated project must build before behavioral checking",
    );
    const entrypoint = await resolveCniEntrypoint(directory);
    let component = await import(pathToFileURL(entrypoint).href);
    for (
      let i = 0;
      i < 3 && !component.codeNativeIntegrationYAML && component.default;
      i++
    )
      component = component.default;
    const report = await verifyRegisteredCsv(component, adapter);
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  });
};
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = error instanceof UnsupportedInterface ? 2 : 1;
  }
}
