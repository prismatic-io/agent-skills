#!/usr/bin/env node
// Simulates Prism 11's signing-key commands against a writable sandbox so evals
// can exercise key creation without registering real keys. Every other command,
// including `me`, runs on the linked Prism build unless local-only mode is set.
// Local-only mode delegates CLI metadata only. The prepared shim sets
// EVAL_LINKED_PRISM, EVAL_STANDIN_LOG_NAME, and EVAL_STANDIN_FALLBACK_LOG. Each
// simulated call is appended to a log inside the current Lux workspace, or to
// the fallback log when run from outside one, for `_verify-embedded-app.mjs`.
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { appendFile, mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

// Prism 11's agent detection in src/cli.ts on next.
const agentEnvironmentVariables = [
  "CLAUDE_CODE",
  "CLAUDECODE",
  "CURSOR_AGENT",
  "CODEX",
  "OPENAI_CODEX",
  "AIDER",
  "CLINE",
  "WINDSURF_AGENT",
  "GITHUB_COPILOT",
  "AMAZON_Q",
  "AWS_Q_DEVELOPER",
  "GEMINI_CODE_ASSIST",
  "SRC_CODY",
  "PI_CODING_AGENT",
  "FORCE_AGENT_MODE",
  "PRISM_AGENT",
  "PRISM_AGENT_MODE",
];
const truthy = (value) => value === "1" || value?.toLowerCase() === "true";

export const isAgentMode = (argv, env) => {
  if (argv.includes("--no-agent") || argv.includes("--agent=false"))
    return false;
  if (argv.includes("--agent") || argv.includes("--agent=true")) return true;
  if (truthy(env.PRISM_NO_AGENT) || truthy(env.FORCE_HUMAN_MODE)) return false;
  return agentEnvironmentVariables.some((name) => truthy(env[name]));
};

const optionValue = (argv, names) => {
  for (const [index, token] of argv.entries()) {
    for (const name of names) {
      if (token === name) return argv[index + 1];
      if (token.startsWith(`${name}=`)) return token.slice(name.length + 1);
    }
  }
  return undefined;
};

/** The simulated command an argument list names, or undefined to pass it through. */
export const simulatedCommand = (argv) => {
  const words = argv
    .filter((token) => !token.startsWith("-"))
    .flatMap((token) => token.split(":"));
  if (argv.some((token) => ["--help", "-h", "--schema"].includes(token)))
    return undefined;
  if (words[0] === "organization" && words[1] === "signing-keys")
    return ["generate", "import", "list", "delete"].includes(words[2])
      ? words[2]
      : undefined;
  return undefined;
};

class StandinError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const requireConfirmation = (agent, argv) => {
  if (agent && !argv.includes("--yes"))
    throw new StandinError(
      "CONFIRMATION_REQUIRED",
      "This command can modify state. Approve with --yes, or context.yes=true in MCP.",
    );
};

// A line of the key body identifies it without storing the key in the log.
export const keyProbe = (privateKey) => privateKey.split("\n")[3];

const newPrivateKey = () =>
  generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  }).privateKey;

/** Run one simulated command; returns the output object and what to log. */
export const runSimulated = async (command, argv, { cwd, env }) => {
  const agent = isAgentMode(argv, env);
  if (command === "list")
    return {
      output: {
        items: [
          {
            id: "T3JnYW5pemF0aW9uU2lnbmluZ0tleTpleGlzdGluZw==",
            privateKeyPreview: "Qx7p1Lz9",
            issuedAt: "2026-06-01T12:00:00Z",
            imported: false,
          },
        ],
      },
      record: {},
    };
  requireConfirmation(agent, argv);
  if (command === "delete")
    return {
      output: { signingKeyId: argv.at(-1), deleted: true },
      record: { signingKeyId: argv.at(-1) },
    };
  if (command === "import") {
    const file = optionValue(argv, ["--public-key-file", "-p"]);
    if (!file)
      throw new StandinError("VALIDATION_ERROR", "Missing --public-key-file");
    const publicKey = await readFile(resolve(cwd, file), "utf8");
    if (!publicKey.includes("PUBLIC KEY"))
      throw new StandinError("COMMAND_FAILED", "The file is not a public key");
    return {
      output: {
        signingKeyId: `T3JnYW5pemF0aW9uU2lnbmluZ0tleTo${randomUUID()}`,
      },
      record: { publicKeyFile: resolve(cwd, file) },
    };
  }
  const privateKeyFile = optionValue(argv, ["--private-key-file", "-o"]);
  if (!privateKeyFile) {
    if (agent)
      throw new StandinError(
        "PRIVATE_KEY_FILE_REQUIRED",
        "Agent mode does not print private signing keys. Retry with --private-key-file <path> to write the key to a new file readable only by you.",
      );
    const privateKey = newPrivateKey();
    return {
      output: { privateKey },
      record: { printed: true, keyProbe: keyProbe(privateKey) },
    };
  }
  const path = resolve(cwd, privateKeyFile);
  const file = await open(path, "wx", 0o600);
  let written = false;
  const privateKey = newPrivateKey();
  try {
    await file.writeFile(privateKey);
    written = true;
  } finally {
    await file.close();
    if (!written) await rm(path, { force: true });
  }
  return {
    output: { privateKeyFile },
    record: {
      printed: false,
      privateKeyFile: path,
      keyProbe: keyProbe(privateKey),
    },
  };
};

const format = (output, argv) =>
  argv.includes("--format=json") ||
  optionValue(argv, ["--format", "--output"]) === "json"
    ? JSON.stringify(output, null, 2)
    : Object.entries(output)
        .map(
          ([key, value]) =>
            `${key}: ${typeof value === "string" && value.includes("\n") ? `|\n${value.replace(/^/gm, "  ")}` : JSON.stringify(value)}`,
        )
        .join("\n");

/** Live workspace roots used by Lux's ordinary and isolated Claude drivers. */
export const luxWorkspace = (cwd) =>
  cwd.match(
    /^.*[/\\](?:lux-workspaces-[^/\\]+[/\\]run-[^/\\]+|lux-claude-workspace-[^/\\]+)/,
  )?.[0];

/** Where a call's log entry goes: the run's own log, or the shared fallback. */
export const logPath = (cwd, { name, fallback }) => {
  const workspace = luxWorkspace(cwd);
  return workspace ? join(workspace, name) : fallback;
};

/** Narrow metadata forms that cannot delegate an account operation. */
export const isMetadataCommand = (argv) => {
  if (
    argv.length === 1 &&
    ["--version", "-v", "--llms", "--llms-full"].includes(argv[0])
  )
    return true;
  if (!["--help", "-h", "--schema"].includes(argv.at(-1))) return false;
  const command = argv
    .slice(0, -1)
    .flatMap((word) => word.split(":"))
    .join(" ");
  return [
    "",
    "me",
    "organization",
    "organization signing-keys",
    ...["generate", "import", "list", "delete"].map(
      (action) => `organization signing-keys ${action}`,
    ),
  ].includes(command);
};

const log = async (entry) => {
  const name = process.env.EVAL_STANDIN_LOG_NAME;
  const fallback = process.env.EVAL_STANDIN_FALLBACK_LOG;
  if (!name || !fallback)
    throw new Error(
      "EVAL_STANDIN_LOG_NAME and EVAL_STANDIN_FALLBACK_LOG are not set; run through the prepared stand-in shim",
    );
  const path = logPath(process.cwd(), { name, fallback });
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(entry)}\n`);
};

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const command = simulatedCommand(argv);
  if (!command) {
    if (
      process.env.EVAL_STANDIN_LOCAL_ONLY === "1" &&
      !isMetadataCommand(argv)
    ) {
      console.error(
        "Embedded evals allow CLI metadata and simulated signing-key commands only.",
      );
      process.exit(2);
    }
    const result = spawnSync(process.env.EVAL_LINKED_PRISM ?? "prism", argv, {
      stdio: "inherit",
    });
    process.exit(result.status ?? 1);
  }
  const entry = {
    time: new Date().toISOString(),
    cwd: process.cwd(),
    argv,
    command,
  };
  try {
    const { output, record } = await runSimulated(command, argv, {
      cwd: process.cwd(),
      env: process.env,
    });
    await log({ ...entry, ...record, status: "ok" });
    console.log(format(output, argv));
  } catch (error) {
    await log({
      ...entry,
      status: "error",
      code: error.code ?? "COMMAND_FAILED",
    });
    console.log(
      `code: ${error.code ?? "COMMAND_FAILED"}\nmessage: ${JSON.stringify(error.message)}\nretryable: false`,
    );
    process.exitCode =
      error.code === "EEXIST" || error.code === "ENOENT" ? 1 : 2;
  }
}
