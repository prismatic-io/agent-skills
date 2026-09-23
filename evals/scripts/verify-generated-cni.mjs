#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const artifacts = resolve(process.argv[2] ?? ".");
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

for (const script of ["typecheck", "lint", "test", "build"]) {
  if (!manifest.scripts[script]) continue;
  const result = spawnSync("npm", ["run", script], {
    cwd: project,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
