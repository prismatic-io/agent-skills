import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

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

if (import.meta.main) {
  const components = await findComponents(process.cwd());
  assert.equal(
    components.length,
    1,
    "Expected one generated Spectral component",
  );
  const [{ directory, pkg }] = components;
  for (const script of ["typecheck", "build", "test"]) {
    assert.ok(pkg.scripts?.[script], `Missing ${script} script`);
    const result = spawnSync("npm", ["run", script], {
      cwd: directory,
      stdio: "inherit",
      timeout: 90_000,
      env: { ...process.env, CI: "true" },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${script} failed`);
  }
}
