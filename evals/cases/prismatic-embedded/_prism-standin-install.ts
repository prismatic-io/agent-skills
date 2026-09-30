import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { linkedPrismBin, prismStandinBin } from "../../prism.ts";

const standinRoot = resolve(prismStandinBin, "..");
// The harness points npm_config_cache at each workspace's .npm-cache, which Lux
// snapshots; a subject has little reason to look there.
export const standinLog = ".npm-cache/_prism/calls.jsonl";
export const standinFallbackLog = join(
  standinRoot,
  "outside-workspace-calls.jsonl",
);

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

/** Write the stand-in shim with absolute paths. */
export const installPrismStandin = async ({
  root = standinRoot,
  linkedPrism = join(linkedPrismBin, "prism"),
} = {}) => {
  const bin = join(root, "bin");
  const fallback = join(root, "outside-workspace-calls.jsonl");
  await mkdir(bin, { recursive: true });
  const shim = join(bin, "prism");
  await writeFile(
    shim,
    `#!/bin/sh
EVAL_LINKED_PRISM=${quote(linkedPrism)} EVAL_STANDIN_LOG_NAME=${quote(standinLog)} EVAL_STANDIN_FALLBACK_LOG=${quote(fallback)} exec ${quote(process.execPath)} ${quote(resolve(import.meta.dirname, "_prism-standin.mjs"))} "$@"
`,
  );
  await chmod(shim, 0o755);
  return bin;
};

if (import.meta.main) console.log(await installPrismStandin());
