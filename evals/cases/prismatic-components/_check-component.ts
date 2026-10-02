import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface ComponentPackage {
  directory: string;
  pkg: {
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
}

export const findComponents = async (
  directory: string,
): Promise<ComponentPackage[]> => {
  let pkg: ComponentPackage["pkg"] | undefined;
  try {
    pkg = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (pkg?.dependencies?.["@prismatic-io/spectral"])
    return [{ directory, pkg }];
  const found: ComponentPackage[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      !entry.name.startsWith(".") &&
      !["node_modules", "dist", "build"].includes(entry.name)
    )
      found.push(...(await findComponents(join(directory, entry.name))));
  }
  return found;
};

const run = (
  directory: string,
  command: string,
  args: string[],
  stdio: "inherit" | "pipe",
) => {
  const result = spawnSync(command, args, {
    cwd: directory,
    stdio,
    encoding: "utf8",
    timeout: 180_000,
    shell: process.platform === "win32" && command === "npm",
  });
  assert.ifError(result.error);
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")} failed\n${result.stdout ?? ""}${result.stderr ?? ""}`,
  );
  return result.stdout;
};

// Invoke the grader's runner with a grader-authored config. A package's `test`
// script is useful evidence, but cannot establish that baseline tests still run.
export const checkBaseline = async (directory: string, fixture: string) => {
  const original = await readFile(join(fixture, "baseline.test.ts"), "utf8");
  const configDir = await mkdtemp(join(directory, ".eval-check-"));
  const testName = `${basename(configDir)}.test.ts`;
  const testPath = join(directory, testName);
  try {
    await writeFile(testPath, original);
    const configPath = join(configDir, "vitest.config.mjs");
    await writeFile(
      configPath,
      `export default ${JSON.stringify({
        root: directory,
        test: {
          include: [testName],
          globals: true,
          environment: "node",
          testTimeout: 15000,
        },
      })};\n`,
    );
    run(
      directory,
      process.execPath,
      [
        resolve(
          dirname(fileURLToPath(import.meta.resolve("vitest/package.json"))),
          "vitest.mjs",
        ),
        "run",
        "--config",
        configPath,
      ],
      "inherit",
    );
  } finally {
    await rm(testPath, { force: true });
    await rm(configDir, { recursive: true, force: true });
  }
};

if (import.meta.main) {
  const components = await findComponents(process.cwd());
  assert.equal(
    components.length,
    1,
    `Expected one generated Spectral component, found ${components.map((c) => c.directory).join(", ") || "none"}`,
  );
  const [{ directory: source, pkg }] = components;
  // Lux supplies this disposable verification workspace with its live dependencies.
  const directory = source;
  for (const script of ["typecheck", "build", "test"]) {
    assert.ok(pkg.scripts?.[script], `Missing ${script} script`);
    run(directory, "npm", ["run", script], "inherit");
  }
  const baselineFlag = process.argv.indexOf("--baseline");
  if (baselineFlag !== -1) {
    const fixture = process.argv[baselineFlag + 1];
    assert.ok(fixture, "Missing baseline fixture path");
    await checkBaseline(directory, fixture);
  }
  const caseFlag = process.argv.indexOf("--case");
  if (caseFlag !== -1) {
    const casePath = process.argv[caseFlag + 1];
    assert.ok(casePath, "Missing case path");
    const { checkEdit } = await import("./_check-edit.ts");
    await checkEdit(directory, casePath);
    console.log(`Independent feature checks passed for ${casePath}`);
  }
}
