#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const excluded = new Set([
  "node_modules",
  ".git",
  ".jj",
  "dist",
  "build",
  ".npm-cache",
]);
export const findCniProjects = async (root) => {
  const projects = [];
  const visit = async (directory) => {
    let manifest;
    try {
      manifest = JSON.parse(
        await readFile(join(directory, "package.json"), "utf8"),
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (
      manifest?.dependencies?.["@prismatic-io/spectral"] ||
      manifest?.devDependencies?.["@prismatic-io/spectral"]
    ) {
      projects.push({ directory, manifest });
      return; // A project's internal directories are not additional projects.
    }
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !excluded.has(entry.name))
        await visit(join(directory, entry.name));
    }
  };
  await visit(resolve(root));
  return projects;
};

export const verifyCni = async (
  root,
  { timeoutMs = 120_000, run = spawnSync } = {},
) => {
  const projects = await findCniProjects(root);
  if (projects.length !== 1)
    return {
      ok: false,
      error: `Expected one generated CNI, found ${projects.length}.`,
      checks: [],
    };
  const { directory, manifest } = projects[0];
  const checks = [];
  const runCheck = (script, command, args) => {
    const result = run(command, args, {
      cwd: directory,
      env: process.env,
      stdio: "inherit",
      timeout: timeoutMs,
      killSignal: "SIGKILL",
      detached: process.platform !== "win32",
    });
    if (
      result.error?.code === "ETIMEDOUT" &&
      result.pid &&
      process.platform !== "win32"
    ) {
      try {
        process.kill(-result.pid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
    checks.push({
      script,
      status: result.status === 0 && !result.error ? "passed" : "failed",
      exitCode: result.status,
      signal: result.signal ?? null,
      error: result.error?.message ?? null,
    });
  };
  if (!manifest.scripts?.build)
    checks.push({
      script: "build",
      status: "missing",
      error: "The generated CNI does not define a build script.",
    });
  for (const script of ["typecheck", "lint", "test", "build"]) {
    if (!manifest.scripts?.[script]) continue;
    runCheck(script, "npm", ["run", script]);
  }
  const built = checks.some(
    (check) => check.script === "build" && check.status === "passed",
  );
  // Prism 11 selects root index.js, then dist/index.js, regardless of main.
  if (built)
    runCheck("entry-load", process.execPath, [
      fileURLToPath(new URL("./_load-cni-entry.mjs", import.meta.url)),
      directory,
    ]);
  return {
    ok: checks.every((check) => check.status === "passed"),
    project: directory,
    checks,
    entryLoad: built ? "checked" : "unassessed",
  };
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const result = await verifyCni(process.argv[2] ?? ".");
    console.log(
      JSON.stringify({ diagnostic: "local-cni-checks", ...result }, null, 2),
    );
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
