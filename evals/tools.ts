import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const evalModules = resolve(import.meta.dirname, "node_modules");
export const evalBin = resolve(evalModules, ".bin");
const packages = ["prism", "lux"] as const;
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  execFileSync(
    "bun",
    ["install", "--cwd", import.meta.dirname, "--frozen-lockfile"],
    { stdio: "inherit" },
  );
  const overrides = packages.flatMap((name) => {
    const spec = process.env[`${name.toUpperCase()}_PACKAGE`];
    return spec ? [spec] : [];
  });
  if (overrides.length) {
    execFileSync(
      "npm",
      [
        "install",
        "--prefix",
        import.meta.dirname,
        "--no-save",
        "--package-lock=false",
        "--no-audit",
        "--no-fund",
        ...overrides,
      ],
      { stdio: "inherit" },
    );
  }
  for (const args of [
    ["components", "init", "--schema", "--format", "json"],
    ["integrations", "validate", "--schema", "--format", "json"],
  ]) {
    execFileSync(
      process.execPath,
      [resolve(evalModules, "@prismatic-io/prism/lib/run.js"), ...args],
      {
        stdio: ["ignore", "ignore", "inherit"],
      },
    );
  }
}
