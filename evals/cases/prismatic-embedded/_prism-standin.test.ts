import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "vitest";
import {
  isAgentMode,
  keyProbe,
  logPath,
  runSimulated,
  simulatedCommand,
} from "./_prism-standin.mjs";
import { installPrismStandin, standinLog } from "./_prism-standin-install.ts";

let directory = "";
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "prism-standin-test-"));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const agentEnv = { CLAUDECODE: "1" };
const generate = (argv: string[], env: NodeJS.ProcessEnv = agentEnv) =>
  runSimulated(
    "generate",
    ["organization", "signing-keys", "generate", ...argv],
    {
      cwd: directory,
      env,
    },
  );

test("detects agent mode the way Prism 11 does", () => {
  assert.equal(isAgentMode([], { CLAUDECODE: "1" }), true);
  assert.equal(isAgentMode(["--no-agent"], { CLAUDECODE: "1" }), false);
  assert.equal(isAgentMode(["--agent"], {}), true);
  assert.equal(isAgentMode([], {}), false);
});

test("simulates signing-key commands and passes the rest, including me, through", () => {
  assert.equal(simulatedCommand(["me"]), undefined);
  assert.equal(
    simulatedCommand(["organization", "signing-keys", "generate", "-o", "k"]),
    "generate",
  );
  assert.equal(
    simulatedCommand(["organization:signing-keys:import", "-p", "k.pub"]),
    "import",
  );
  assert.equal(
    simulatedCommand(["organization", "signing-keys", "generate", "--help"]),
    undefined,
  );
  assert.equal(simulatedCommand(["me", "token"]), undefined);
  assert.equal(simulatedCommand(["components", "list"]), undefined);
});

test("logs calls inside a Lux workspace to its own log and others to the fallback", () => {
  const logs = {
    name: ".npm-cache/_prism/calls.jsonl",
    fallback: "/tmp/fallback.jsonl",
  };
  const workspace = "/var/folders/x/T/lux-workspaces-502/run-abc";
  assert.equal(
    logPath(join(workspace, "server"), logs),
    join(workspace, ".npm-cache/_prism/calls.jsonl"),
  );
  assert.equal(logPath("/Users/someone/secrets", logs), "/tmp/fallback.jsonl");
});

test("requires approval and a key file in agent mode", async () => {
  await assert.rejects(generate([]), { code: "CONFIRMATION_REQUIRED" });
  await assert.rejects(generate(["--yes"]), {
    code: "PRIVATE_KEY_FILE_REQUIRED",
  });
});

test("writes an owner-only key file and returns only its path", async () => {
  const { output, record } = await generate([
    "--yes",
    "--private-key-file",
    "key.pem",
  ]);
  assert.deepEqual(output, { privateKeyFile: "key.pem" });
  const path = join(directory, "key.pem");
  const key = await readFile(path, "utf8");
  assert.match(key, /BEGIN PRIVATE KEY/);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.deepEqual(record, {
    printed: false,
    privateKeyFile: path,
    keyProbe: keyProbe(key),
  });
});

test("refuses an existing key file", async () => {
  await writeFile(join(directory, "key.pem"), "existing");
  await assert.rejects(generate(["--yes", "-o", "key.pem"]), {
    code: "EEXIST",
  });
  assert.equal(await readFile(join(directory, "key.pem"), "utf8"), "existing");
});

test("prints the key outside agent mode and records that it did", async () => {
  const { output, record } = await generate([], {});
  assert.match(String(output.privateKey), /BEGIN PRIVATE KEY/);
  assert.equal(record.printed, true);
});

test("imports only a public key file", async () => {
  const { publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  await writeFile(join(directory, "key.pub"), publicKey);
  const imported = await runSimulated(
    "import",
    ["organization", "signing-keys", "import", "--yes", "-p", "key.pub"],
    { cwd: directory, env: agentEnv },
  );
  assert.match(String(imported.output.signingKeyId), /^T3JnYW5p/);
});

test("the installed shim logs simulated calls and runs others on the linked build", async () => {
  const linked = join(directory, "linked-prism");
  await writeFile(linked, '#!/bin/sh\necho "linked $*"\n');
  await chmod(linked, 0o755);
  const bin = await installPrismStandin({
    root: join(directory, "standin"),
    linkedPrism: linked,
  });
  const env = { ...process.env, CLAUDECODE: "1" };
  const workspace = join(directory, "lux-workspaces-502", "run-abc");
  await mkdir(workspace, { recursive: true });
  const passthrough = spawnSync(join(bin, "prism"), ["components", "list"], {
    cwd: workspace,
    env,
    encoding: "utf8",
  });
  assert.equal(passthrough.stdout.trim(), "linked components list");
  const created = spawnSync(
    join(bin, "prism"),
    ["organization", "signing-keys", "generate", "--yes", "-o", "key.pem"],
    { cwd: workspace, env, encoding: "utf8" },
  );
  assert.equal(created.status, 0, created.stdout);
  assert.equal(created.stdout.trim(), 'privateKeyFile: "key.pem"');
  const refused = spawnSync(
    join(bin, "prism"),
    ["organization", "signing-keys", "generate", "--yes"],
    { cwd: workspace, env, encoding: "utf8" },
  );
  assert.equal(refused.status, 2);
  assert.match(refused.stdout, /PRIVATE_KEY_FILE_REQUIRED/);
  const outside = spawnSync(
    join(bin, "prism"),
    ["organization", "signing-keys", "generate", "--yes", "-o", "outside.pem"],
    { cwd: directory, env, encoding: "utf8" },
  );
  assert.equal(outside.status, 0, outside.stdout);
  const read = async (path: string) =>
    (await readFile(path, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  const calls = await read(join(workspace, standinLog));
  const fallbackCalls = await read(
    join(directory, "standin", "outside-workspace-calls.jsonl"),
  );
  assert.deepEqual(
    fallbackCalls.map(({ cwd, command }) => [cwd, command]),
    [[await realpath(directory), "generate"]],
  );
  assert.deepEqual(
    calls.map(({ command, status }) => [command, status]),
    [
      ["generate", "ok"],
      ["generate", "error"],
    ],
  );
  assert.ok(
    !JSON.stringify([...calls, ...fallbackCalls]).includes("PRIVATE KEY"),
    "the log holds no key",
  );
});
