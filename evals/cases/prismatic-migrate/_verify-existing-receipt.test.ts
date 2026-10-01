import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const require = createRequire(import.meta.url);
const spectral = require.resolve("@prismatic-io/spectral");
const verifier = fileURLToPath(
  new URL("./_verify-existing-receipt.mjs", import.meta.url),
);

// Real Spectral registration exercises the checker across implementation layouts.
// This fixture has no dependency on the subject's source paths or test assertions.
const source = `
const { integration, flow, configVar, configPage } = require(${JSON.stringify(spectral)});
module.exports = integration({
  name: 'Warehouse Integration',
  configPages: { Warehouse: configPage({elements: {
    'Receipt Prefix': configVar({stableKey:'warehouse-receipt-prefix',dataType:'string',defaultValue:'RCPT'})
  }}) },
  flows: [flow({name:'Acknowledge Warehouse Receipt',stableKey:'warehouse-receipt-v1',onExecution:async(context, params)=>{
    const {eventId,warehouse}=params.onTrigger.results.body.data;
    if(typeof eventId!=='string'||!eventId.length) throw new Error('eventId must be a nonempty string');
    if(typeof warehouse!=='string'||!warehouse.length) throw new Error('warehouse must be a nonempty string');
    return {data:{eventId,reference:context.configVars['Receipt Prefix']+':'+warehouse+':'+eventId,status:'accepted'},instanceState:{internal:1}};
  }})]
});`;

const check = async (code: string, entrypoint = "dist/index.js") => {
  const directory = await mkdtemp(join(tmpdir(), "receipt-checker-test-"));
  try {
    const project = join(directory, "existing-integration");
    await mkdir(join(project, "node_modules"), { recursive: true });
    await writeFile(
      join(project, "package.json"),
      JSON.stringify({
        main: "src/index.ts",
        dependencies: { "@prismatic-io/spectral": "10.30.3" },
        scripts: { build: "node build.cjs" },
      }),
    );
    await writeFile(join(project, "source.cjs"), code);
    await writeFile(
      join(project, "build.cjs"),
      `const fs=require('node:fs/promises');fs.mkdir('dist').then(() => fs.copyFile('source.cjs',${JSON.stringify(entrypoint)}));`,
    );
    const result = spawnSync(process.execPath, [verifier, directory], {
      encoding: "utf8",
      timeout: 15000,
    });
    assert.ifError(result.error);
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

test("receipt checker accepts dist/index.js despite a source package.main", async () => {
  const result = await check(source);
  assert.equal(result.status, 0, result.output);
}, 30_000);

test("receipt checker accepts a root index.js entrypoint", async () => {
  const result = await check(source, "index.js");
  assert.equal(result.status, 0, result.output);
});

test("receipt checker distinguishes missing Prism entrypoint from receipt behavior", async () => {
  const result = await check(source, "dist/index.cjs");
  assert.notEqual(result.status, 0);
  assert.match(result.output, /Missing compiled CNI entrypoint/);
  assert.doesNotMatch(result.output, /receipt flow identity must survive/);
});

test("receipt checker independently catches changed flow identity", async () => {
  const result = await check(
    source.replace("warehouse-receipt-v1", "new-receipt-v2"),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.output, /receipt flow identity must survive/);
});

test("receipt checker independently catches changed customer configuration identity", async () => {
  const result = await check(
    source.replace("warehouse-receipt-prefix", "new-prefix"),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.output, /warehouse-receipt-prefix/);
});

test("receipt checker independently catches changed caller response", async () => {
  const result = await check(
    source.replace("status:'accepted'", "status:'ok'"),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.output, /accepted/);
});
