import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";

const { prepareAttachment } = await import(
  new URL("./scripts/prepare-registration-evidence.mjs", import.meta.url).href
);
const req = createRequire(import.meta.url),
  spectral = req.resolve("@prismatic-io/spectral"),
  yaml = req.resolve("yaml");
const withProject = async (
  source: string | null,
  fn: (directory: string) => Promise<void>,
) => {
  const dir = await mkdtemp(join(tmpdir(), "registration-attachment-"));
  try {
    await mkdir(join(dir, "dist"));
    await writeFile(join(dir, "package.json"), "{}");
    if (source !== null) await writeFile(join(dir, "dist/index.js"), source);
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};
const source = (elements = "", after = "") =>
  `const {integration,flow,configPage,connectionConfigVar,OAuth2Type}=require(${JSON.stringify(spectral)});const c=integration({name:'Control',flows:[flow({name:'Flow',stableKey:'flow',onExecution:async()=>({data:null})})],configPages:{Settings:configPage({elements:{${elements}}})}}); ${after} module.exports=c;`;
test("no project yields explicit N/A, no inferred requirement or facts", async () => {
  const a = await prepareAttachment();
  assert.equal(a.status, "not-applicable");
  assert.deepEqual(a.projects, []);
  assert.deepEqual(a.contractFacts, []);
});
test("generic connection is available without OAuth verdict and module output is discarded", async () =>
  withProject(
    source(
      "Generic:connectionConfigVar({stableKey:'generic',dataType:'connection',inputs:{token:{label:'SECRET_SENTINEL',type:'password',default:'SECRET_SENTINEL'}}})",
      "console.log('SECRET_SENTINEL'); require('node:fs').writeSync(2,'SECRET_SENTINEL');",
    ),
    async (dir) => {
      const a = await prepareAttachment([dir]);
      assert.equal(a.status, "available");
      assert.deepEqual(
        a.projects[0].registration.localConnections[0].oauthDeclaration,
        {},
      );
      assert.equal(JSON.stringify(a).includes("SECRET_SENTINEL"), false);
      assert.equal("passed" in a, false);
    },
  ));
test("local OAuth declaration remains factual", async () =>
  withProject(
    source(
      "OAuth:connectionConfigVar({stableKey:'oauth',dataType:'connection',oauth2Type:OAuth2Type.AuthorizationCode,inputs:{clientSecret:{label:'secret',type:'password',default:'SECRET_SENTINEL'}}})",
    ),
    async (dir) => {
      const a = await prepareAttachment([dir]);
      assert.equal(
        a.projects[0].registration.localConnections[0].oauthDeclaration
          .oauth2Type,
        "authorization_code",
      );
      assert.equal(
        a.contractFacts.some(
          (f: { id: string }) => f.id === "local-oauth-declaration",
        ),
        true,
      );
      assert.equal(JSON.stringify(a).includes("SECRET_SENTINEL"), false);
    },
  ));
test("referenced connection subtype remains unresolved; no local OAuth required", async () =>
  withProject(
    source(
      "",
      `const y=require(${JSON.stringify(yaml)});const d=y.parse(c.codeNativeIntegrationYAML);d.requiredConfigVars=[{key:'Remote',dataType:'connection',connection:{key:'auth',component:{key:'vendor',isPublic:true}}}];c.codeNativeIntegrationYAML=y.stringify(d);`,
    ),
    async (dir) => {
      const a = await prepareAttachment([dir]);
      assert.equal(a.status, "available");
      assert.deepEqual(a.projects[0].registration.localConnections, []);
      assert.equal(
        a.projects[0].registration.configBindings[0].connection.componentScope,
        "referenced",
      );
      assert.equal(
        a.contractFacts.some(
          (f: { id: string }) => f.id === "local-oauth-declaration",
        ),
        true,
      );
      assert.match(
        a.contractFacts.find(
          (f: { id: string; text: string }) => f.id === "caller-response-mode",
        ).text,
        /webhook invocations/,
      );
    },
  ));
test("missing entrypoint and throwing project report sanitized unavailable evidence", async () => {
  for (const src of [
    null,
    "throw Error('SECRET_SENTINEL');",
    "module.exports={helper:()=>42};",
  ])
    await withProject(src, async (dir) => {
      const a = await prepareAttachment([dir]);
      assert.equal(a.projects[0].status, "unavailable");
      assert.equal(JSON.stringify(a).includes("SECRET_SENTINEL"), false);
      assert.deepEqual(a.contractFacts, []);
    });
});
test("multiple projects retain independent available and unavailable observations", async () =>
  withProject(source(), async (good) =>
    withProject(null, async (bad) => {
      const a = await prepareAttachment([good, bad]);
      assert.equal(a.status, "partial-or-unavailable");
      assert.equal(a.projects[0].status, "available");
      assert.equal(a.projects[1].status, "unavailable");
      assert.equal(
        a.projects[0].registration.evidenceLimits.buildFreshness,
        "caller-established-not-checked",
      );
    }),
  ));
