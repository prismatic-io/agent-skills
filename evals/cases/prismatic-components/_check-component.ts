import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  constants,
  cp,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
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

const exists = async (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

export const dependencyInstall = async (directory: string) => {
  if (
    (await exists(join(directory, "bun.lock"))) ||
    (await exists(join(directory, "bun.lockb")))
  )
    return { command: "bun", args: ["install", "--frozen-lockfile"] };
  if (await exists(join(directory, "package-lock.json")))
    return { command: "npm", args: ["ci", "--no-audit", "--no-fund"] };
  console.log("No dependency lockfile supplied; restoring from package.json.");
  return { command: "npm", args: ["install", "--no-audit", "--no-fund"] };
};

// Regrading provides immutable source evidence without build or dependency trees.
// All tools operate in a disposable copy so live and frozen runs obey that contract.
export const withComponentWorkspace = async <T>(
  source: string,
  check: (directory: string) => Promise<T>,
): Promise<T> => {
  const workspace = await mkdtemp(join(tmpdir(), "component-check-"));
  try {
    const directory = join(workspace, basename(source));
    const excluded = new Set(["node_modules", "dist", "build", ".git", ".jj"]);
    await cp(source, directory, {
      recursive: true,
      filter: (path) => path === source || !excluded.has(basename(path)),
    });
    const dependencies = join(source, "node_modules");
    if (await exists(dependencies)) {
      // Keep module paths local: external symlinks change bundler output and signatures.
      await cp(await realpath(dependencies), join(directory, "node_modules"), {
        recursive: true,
        verbatimSymlinks: true,
        mode: constants.COPYFILE_FICLONE,
        filter: (path) =>
          ![".cache", ".vite", ".vite-temp"].includes(basename(path)),
      });
    } else {
      const install = await dependencyInstall(directory);
      run(directory, install.command, install.args, "inherit");
    }
    console.log(
      `Checking source ${source} in disposable workspace ${directory}`,
    );
    return await check(directory);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
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
  await withComponentWorkspace(source, async (directory) => {
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
  });
}
