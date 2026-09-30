import { copyFile, mkdir, rename, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

export const preparePrism = async (
  prismRoot = process.env.PRISM_ROOT ??
    resolve(import.meta.dirname, "../../prism"),
  cacheBin = resolve(
    import.meta.dirname,
    ".lux-cache",
    basename(prismRoot),
    "bin",
  ),
) => {
  const entrypoint = resolve(prismRoot, "lib/run.js");
  if (!(await stat(entrypoint)).isFile())
    throw new Error("Prism build is missing");
  await mkdir(cacheBin, { recursive: true });
  // Keep Node's module lookup inside the cache's existing sandbox read grant.
  const packageFile = resolve(cacheBin, `package.${process.pid}.tmp`);
  await writeFile(packageFile, '{"private":true,"type":"module"}\n');
  await rename(packageFile, resolve(cacheBin, "package.json"));
  const filter = resolve(cacheBin, `prism-output.${process.pid}.tmp`);
  await copyFile(resolve(import.meta.dirname, "prism-output.ts"), filter);
  await rename(filter, resolve(cacheBin, "prism-output.ts"));
  const launcher = resolve(cacheBin, `prism.${process.pid}.tmp`);
  await writeFile(
    launcher,
    `#!/usr/bin/env node\nimport { runPrism } from "./prism-output.ts";\nprocess.exitCode = await runPrism(${JSON.stringify(entrypoint)}, process.argv.slice(2));\n`,
    { mode: 0o755 },
  );
  // Replace the old symlink itself; never write through it into Prism's build.
  const executable = resolve(cacheBin, "prism");
  await rename(launcher, executable);
  return executable;
};

if (import.meta.main) await preparePrism();
