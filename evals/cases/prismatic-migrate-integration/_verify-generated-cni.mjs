#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { withComponentWorkspace as withProjectWorkspace } from "../prismatic-components/_check-component.ts";
import { resolveCniEntrypoint } from "./_cni-entrypoint.mjs";

const artifacts = resolve(process.argv[2] ?? ".");
const mode = process.argv[3] ?? "all";
assert.ok(
  ["all", "build", "checks"].includes(mode),
  "Expected all, build, or checks mode",
);
const entries = await readdir(artifacts, { withFileTypes: true });
const candidates = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => resolve(artifacts, entry.name));
const projects = (
  await Promise.all(
    candidates.map(async (directory) => {
      try {
        const manifest = JSON.parse(
          await readFile(resolve(directory, "package.json"), "utf8"),
        );
        return manifest.dependencies?.["@prismatic-io/spectral"]
          ? directory
          : undefined;
      } catch {
        return undefined;
      }
    }),
  )
).filter((directory) => directory !== undefined);

if (projects.length !== 1) {
  console.error(`Expected one generated CNI, found ${projects.length}.`);
  process.exit(2);
}

const project = projects[0];
const manifest = JSON.parse(
  await readFile(resolve(project, "package.json"), "utf8"),
);
if (!manifest.scripts?.build) {
  console.error("The generated CNI does not define a build script.");
  process.exit(2);
}

// Subject dependencies may have been installed on a different OS in Docker.
// Restore in the disposable workspace using its lockfile for this host.
await withProjectWorkspace(
  project,
  async (directory) => {
    const scripts =
      mode === "build"
        ? ["typecheck", "build"]
        : mode === "checks"
          ? ["lint", "test"]
          : ["typecheck", "lint", "test", "build"];
    for (const script of scripts) {
      if (!manifest.scripts[script]) continue;
      const result = spawnSync("npm", ["run", script], {
        cwd: directory,
        env: process.env,
        stdio: "inherit",
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, `npm run ${script} failed`);
    }

    if (mode === "checks") {
      console.log(
        "Declared lint/test checks completed; this does not establish behavioral preservation.",
      );
      return;
    }

    const entrypoint = await resolveCniEntrypoint(directory);
    let component = await import(pathToFileURL(entrypoint).href);
    // ESM and bundled CommonJS entrypoints expose different default wrappers.
    for (
      let depth = 0;
      depth < 3 && !component.codeNativeIntegrationYAML && component.default;
      depth++
    ) {
      component = component.default;
    }
    assert.equal(
      typeof component.codeNativeIntegrationYAML,
      "string",
      "Built entrypoint must export a Spectral integration, not detached helpers",
    );
    const definition = parse(component.codeNativeIntegrationYAML);
    assert.equal(
      definition?.isCodeNative,
      true,
      "Missing code-native integration definition",
    );
    assert.ok(
      typeof component.key === "string" && component.key.length > 0,
      "Missing generated component key",
    );
    assert.ok(
      Array.isArray(definition.flows) && definition.flows.length > 0,
      "Integration must register at least one flow",
    );
    for (const flow of definition.flows) {
      const execution = flow.steps?.find(
        (step) =>
          !step.isTrigger && step.action?.component?.key === component.key,
      );
      assert.ok(
        execution,
        `Flow ${flow.name} does not reference its generated execution action`,
      );
      assert.equal(
        typeof component.actions?.[execution.action.key]?.perform,
        "function",
        `Flow ${flow.name} has no executable registered action`,
      );
    }
    console.log(
      `Validated ${definition.flows.length} registered CNI flow(s) from ${entrypoint}`,
    );
  },
  { dependencyMode: "install" },
);
