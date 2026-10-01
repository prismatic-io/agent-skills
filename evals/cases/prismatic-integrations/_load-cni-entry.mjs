import { createRequire, syncBuiltinESMExports } from "node:module";
import net from "node:net";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveCniEntrypoint } from "../_cni-entrypoint.mjs";

// Registration should be local. This is not a sandbox for arbitrary code;
// generated scripts and modules still belong in a disposable environment.
const denyNetwork = () => {
  throw new Error("Network connections are disabled during CNI entry loading.");
};
globalThis.fetch = denyNetwork;
net.Socket.prototype.connect = denyNetwork;
syncBuiltinESMExports();

const directory = resolve(process.argv[2]);
const require = createRequire(pathToFileURL(join(directory, "package.json")));
const entry = await resolveCniEntrypoint(directory);
const definition = require(entry).default;
if (!definition?.codeNativeIntegrationYAML)
  throw new Error(
    "Prism CNI entry has no default integration definition with codeNativeIntegrationYAML.",
  );
