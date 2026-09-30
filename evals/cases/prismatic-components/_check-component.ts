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
  const found: ComponentPackage[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      entry.name.startsWith(".") ||
      ["node_modules", "dist", "build"].includes(entry.name)
    )
      continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await findComponents(path)));
    if (entry.isFile() && entry.name === "package.json") {
      const pkg = JSON.parse(await readFile(path, "utf8"));
      if (pkg.dependencies?.["@prismatic-io/spectral"])
        found.push({ directory, pkg });
    }
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
    env: { ...process.env, CI: "true" },
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
  const { signature } = JSON.parse(
    run(
      directory,
      "prism",
      ["components", "signature", "--format", "json"],
      "pipe",
    ),
  );
  assert.ok(
    typeof signature === "string" && signature.length > 0,
    "No matching published component version found: publication is missing or differs from the local build",
  );
  console.log(`Published signature ${signature} matches ${directory}`);
  const caseFlag = process.argv.indexOf("--case");
  if (caseFlag !== -1) {
    const casePath = process.argv[caseFlag + 1];
    assert.ok(casePath, "Missing case path");
    const { checkEdit } = await import("./_check-edit.ts");
    await checkEdit(directory, casePath);
    console.log(`Independent feature checks passed for ${casePath}`);
  }
}
