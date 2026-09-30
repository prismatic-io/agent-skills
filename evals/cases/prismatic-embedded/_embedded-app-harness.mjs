#!/usr/bin/env node
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Loads the fixture's `createApp()` contract and reports the listening port.
const root = resolve(process.argv[2] ?? ".");
try {
  const { createApp } = await import(
    pathToFileURL(join(root, "server", "app.ts")).href
  );
  if (typeof createApp !== "function")
    throw new Error("server/app.ts no longer exports createApp()");
  const server = createServer(await createApp());
  server.listen(0, "127.0.0.1", () => {
    console.log(JSON.stringify({ port: server.address().port }));
  });
} catch (error) {
  console.log(
    JSON.stringify({ error: `Could not start the app: ${error.message}` }),
  );
  process.exitCode = 1;
}
