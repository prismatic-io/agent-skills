import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const worker = fileURLToPath(
  new URL("./registration-evidence-worker.mjs", import.meta.url),
);
const inspector = fileURLToPath(
  new URL("./inspect-cni-registration.mjs", import.meta.url),
);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const factCatalog = {
  oauth: {
    id: "local-oauth-declaration",
    text: "A local OAuth connection uses an explicit oauth2Type declaration. A generic connection can be valid without OAuth. Referenced component connections require their own contract; missing local OAuth fields do not classify a remote connection.",
    source: "https://prismatic.io/docs/integrations/code-native/config-wizard/",
    checkedAt: "2026-09-25",
    localDocumentSha256:
      "7222123af021065a8df758b3d86d463b7f79cdd63ac0feb24083f17816d5730f",
  },
  response: {
    id: "caller-response-mode",
    text: "Prismatic webhook invocations are asynchronous by default. A synchronous flow setting or supported invocation override can return the final result. Local registration does not establish a deployed setting or caller headers, and neither mode is universally required.",
    source:
      "https://prismatic.io/docs/integrations/triggers/webhook/synchronous-and-asynchronous/",
    checkedAt: "2026-09-25",
    localDocumentSha256:
      "1b79d83ec1dfc8ca0646cc4c29797b091ea75fbb757220d77a5149e3fceeae10",
  },
};
export const prepareAttachment = async (projects = []) => {
  const base = {
    schemaVersion: 1,
    evidenceKind: "manual-reviewer-registration-evidence",
    producer: {
      inspectorSha256: sha(await readFile(inspector)),
      workerSha256: sha(await readFile(worker)),
      preparerSha256: sha(await readFile(fileURLToPath(import.meta.url))),
      nodeVersion: process.version,
    },
    limits: [
      "No score or correctness verdict. Missing metadata is not a requirement violation.",
      "Caller supplies already rebuilt disposable projects; freshness and isolation are not established here.",
      "No dependencies installed, model called, hosted behavior tested or credentials provided.",
      "Values/defaults and raw module logs/errors are excluded. Identifiers remain visible and require caller secret review.",
      "Config destinations and user/scoped connection relationships are omitted. No ownership or correct-wiring inference.",
      "Imports execute project code; this subprocess is not a security or network sandbox.",
    ],
    projects: [],
    contractFacts: [],
  };
  if (!Array.isArray(projects) || projects.some((p) => typeof p !== "string"))
    throw new TypeError("Expected project path strings");
  if (projects.length === 0)
    return {
      ...base,
      status: "not-applicable",
      reason: "no-projects-supplied; no implementation requirement inferred",
    };
  if (projects.length > 8)
    return {
      ...base,
      status: "unavailable",
      reason: "project-count-exceeds-bounded-review-limit",
    };
  const facts = new Set();
  for (let i = 0; i < projects.length; i++) {
    const directory = resolve(projects[i]);
    const entry = { id: `project-${i + 1}` };
    const child = spawnSync(process.execPath, [worker, directory], {
      cwd: directory,
      env: { NODE_ENV: "test" },
      stdio: ["ignore", "ignore", "ignore", "pipe"],
      timeout: 15000,
      maxBuffer: 16000,
    });
    if (child.error || child.status !== 0) {
      base.projects.push({
        ...entry,
        status: "unavailable",
        reason: "isolated-import-failed-or-exceeded-resource-limit",
      });
      continue;
    }
    let observation;
    try {
      observation = JSON.parse(child.output[3]?.toString() ?? "");
    } catch {
      base.projects.push({
        ...entry,
        status: "unavailable",
        reason: "invalid-or-oversized-extractor-output",
      });
      continue;
    }
    if (
      observation.status !== "available" ||
      observation.registration?.evidenceKind !== "local-registration"
    ) {
      base.projects.push({
        ...entry,
        status: "unavailable",
        reason: "registration-import-or-shape-check-failed",
      });
      continue;
    }
    // Version is informational: bundled code is not proven identical to this package.
    let declaredSdkVersion;
    try {
      const pkg = JSON.parse(
        await readFile(
          resolve(
            directory,
            "node_modules/@prismatic-io/spectral/package.json",
          ),
          "utf8",
        ),
      );
      if (
        typeof pkg.version === "string" &&
        /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(pkg.version)
      )
        declaredSdkVersion = pkg.version;
    } catch {}
    base.projects.push({
      ...entry,
      ...observation,
      ...(declaredSdkVersion
        ? { installedSdkVersion: declaredSdkVersion }
        : {}),
    });
    if (
      observation.registration.localConnections?.length ||
      observation.registration.configBindings?.some((c) => c.connection)
    )
      facts.add("oauth");
    if (observation.registration.flows?.length) facts.add("response");
  }
  base.contractFacts = [...facts].map((k) => factCatalog[k]);
  const result = {
    ...base,
    status: base.projects.every((p) => p.status === "available")
      ? "available"
      : "partial-or-unavailable",
  };
  if (JSON.stringify(result).length > 32000)
    return {
      ...base,
      projects: base.projects.map((p) => ({
        id: p.id,
        status: "unavailable",
        reason: "combined-evidence-budget-exceeded",
      })),
      contractFacts: [],
      status: "unavailable",
    };
  return result;
};
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(
      JSON.stringify(await prepareAttachment(process.argv.slice(2)), null, 2),
    );
  } catch {
    console.log(
      JSON.stringify({
        schemaVersion: 1,
        status: "unavailable",
        reason: "attachment-preparation-failed",
      }),
    );
    process.exitCode = 1;
  }
}
