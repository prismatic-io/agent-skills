import { spawnSync } from "node:child_process";
import { lstat, realpath, stat } from "node:fs/promises";
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

const within = (root, path) => {
  const offset = relative(root, path);
  return (
    offset !== ".." && !offset.startsWith(`..${sep}`) && !isAbsolute(offset)
  );
};
const present = async (path) => {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
};

/**
 * Mirrors Prism11 src/utils/import.ts + integration/import.ts discovery:
 * cwd/index.js takes precedence; otherwise nearest package.json -> dist/index.js.
 * package.main is irrelevant. Search stays inside the supplied disposable project.
 * This checks containment and JavaScript syntax, not build freshness, dependencies,
 * Spectral registration, or whether loading the module has side effects.
 */
export const resolveCniEntrypoint = async (
  projectDirectory,
  workingDirectory = projectDirectory,
) => {
  const root = await realpath(resolve(projectDirectory));
  const cwd = await realpath(resolve(workingDirectory));
  if (!(await stat(root)).isDirectory() || !(await stat(cwd)).isDirectory())
    throw new Error("CNI project and working directory must be directories");
  if (!within(root, cwd))
    throw new Error("CNI working directory must remain inside the project");
  let candidate = resolve(cwd, "index.js");
  if (!(await present(candidate))) {
    let directory = cwd;
    while (!(await present(resolve(directory, "package.json")))) {
      if (directory === root)
        throw new Error("No package.json found inside the CNI project");
      directory = dirname(directory);
    }
    const manifest = await realpath(resolve(directory, "package.json"));
    if (!within(root, manifest) || !(await stat(manifest)).isFile())
      throw new Error("CNI package.json must be a file inside the project");
    candidate = resolve(directory, "dist/index.js");
  }
  if (!(await present(candidate)))
    throw new Error(
      "Missing compiled CNI entrypoint: expected index.js or package dist/index.js",
    );
  const entrypoint = await realpath(candidate);
  if (!within(root, entrypoint))
    throw new Error("CNI entrypoint must remain inside the project");
  if (!(await stat(entrypoint)).isFile())
    throw new Error("CNI entrypoint must be a regular file");
  if ([".ts", ".tsx", ".mts", ".cts"].includes(extname(entrypoint)))
    throw new Error(
      "CNI entrypoint must be compiled JavaScript, not TypeScript source",
    );
  const checked = spawnSync(process.execPath, ["--check", entrypoint], {
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 256_000,
  });
  if (checked.error) throw checked.error;
  if (checked.status !== 0)
    throw new Error(
      `CNI entrypoint is not valid JavaScript: ${checked.stderr.trim()}`,
    );
  return entrypoint;
};
