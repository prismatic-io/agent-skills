import { chmod, copyFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { preparePrism } from "../../prepare-prism.ts";
import { prismBin, prismStandinBin } from "../../prism.ts";

const standinRoot = resolve(prismStandinBin, "..");
// The harness points npm_config_cache at each workspace's .npm-cache, which Lux
// snapshots; a subject has little reason to look there.
export const standinLog = ".npm-cache/_prism/calls.jsonl";
export const standinFallbackLog = join(
  prismBin,
  "..",
  "outside-workspace-calls.jsonl",
);

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

/** Write the stand-in shim with absolute paths. */
export const installPrismStandin = async ({
  root = standinRoot,
  linkedPrism,
  localOnly = false,
}: {
  root?: string;
  linkedPrism?: string;
  localOnly?: boolean;
} = {}) => {
  const bin = join(root, "bin");
  const fallback = join(root, "outside-workspace-calls.jsonl");
  await mkdir(bin, { recursive: true });
  const shim = join(bin, "prism");
  const delegate =
    linkedPrism ?? (await preparePrism(undefined, join(bin, "linked")));
  const script = join(bin, "standin.mjs");
  await copyFile(resolve(import.meta.dirname, "_prism-standin.mjs"), script);
  await writeFile(
    join(bin, "package.json"),
    '{"private":true,"type":"module"}\n',
  );
  await writeFile(
    shim,
    `#!/bin/sh
EVAL_STANDIN_LOCAL_ONLY=${localOnly ? "1" : "0"} EVAL_LINKED_PRISM=${quote(delegate)} EVAL_STANDIN_LOG_NAME=${quote(standinLog)} EVAL_STANDIN_FALLBACK_LOG=${quote(fallback)} exec ${quote(process.execPath)} ${quote(script)} "$@"
`,
  );
  await chmod(shim, 0o755);
  return bin;
};

if (import.meta.main) console.log(await installPrismStandin());
