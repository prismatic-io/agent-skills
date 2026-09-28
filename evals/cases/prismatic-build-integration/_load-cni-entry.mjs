import { access } from "node:fs/promises";
import { createRequire, syncBuiltinESMExports } from "node:module";
import net from "node:net";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
};
// Prism 11 loads a root index.js when present, otherwise dist/index.js. Its
// integration importer then requires a default CNI definition with generated YAML.
const rootEntry = join(directory, "index.js");
const entry = (await exists(rootEntry))
  ? rootEntry
  : join(directory, "dist", "index.js");
if (!(await exists(entry)))
  throw new Error(
    "Prism CNI entry index.js is missing at the project root or dist/.",
  );
const definition = require(entry).default;
if (!definition?.codeNativeIntegrationYAML)
  throw new Error(
    "Prism CNI entry has no default integration definition with codeNativeIntegrationYAML.",
  );
