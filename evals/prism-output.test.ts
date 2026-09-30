import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { preparePrism } from "./prepare-prism.ts";
import { PrismOutputFilter } from "./prism-output.ts";

const jwt = "eyJmYWtlIjoxfQ.cGF5bG9hZA.c2lnbmF0dXJl";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const fixture = async (source: string) => {
  const root = await mkdtemp(join(tmpdir(), "prism-output-test-"));
  roots.push(root);
  const prismRoot = join(root, "prism");
  const bin = join(root, "cache/bin");
  await mkdir(join(prismRoot, "lib"), { recursive: true });
  await mkdir(bin, { recursive: true });
  const target = join(prismRoot, "lib/run.js");
  await writeFile(target, source);
  await symlink(target, join(bin, "prism"));
  return { target, executable: await preparePrism(prismRoot, bin), source };
};

const environment = {
  PATH: dirname(process.execPath),
  NODE_NO_WARNINGS: "1",
  PRISM_READ_ONLY: "true",
};

test("launcher replaces a symlink without modifying Prism and preserves args, selectors and status", async () => {
  const f = await fixture(`
    console.log(JSON.stringify({args:process.argv.slice(2),readOnly:process.env.PRISM_READ_ONLY}));
    console.error("AxiosError: 401; Authorization: 'Bearer ${jwt}'");
    process.exitCode=7;
  `);
  const result = spawnSync(
    process.execPath,
    [f.executable, "--schema", "literal $(not-a-shell)"],
    {
      encoding: "utf8",
      env: environment,
    },
  );
  expect(result.status).toBe(7);
  expect(JSON.parse(result.stdout)).toEqual({
    args: ["--schema", "literal $(not-a-shell)"],
    readOnly: "true",
  });
  expect(result.stderr).toContain(
    "AxiosError: 401; Authorization: 'Bearer [REDACTED]'",
  );
  expect(result.stderr).not.toContain(jwt);
  expect(await readFile(f.target, "utf8")).toBe(f.source);
});

test("actual child writes cannot leak credentials split across chunks or a final unterminated line", async () => {
  const f = await fixture(`
    const token=${JSON.stringify(jwt)};
    process.stdout.write("prefix λ\\nAuthorization: Be");
    setTimeout(()=>{
      process.stdout.write("arer "+token.slice(0,12));
      setTimeout(()=>{
        process.stdout.write(token.slice(12)+"\\r\\nend\\n");
        process.stderr.write(JSON.stringify({request:{accessToken:token}}));
      },10);
    },10);
  `);
  const result = spawnSync(process.execPath, [f.executable], {
    encoding: "utf8",
    env: environment,
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toBe(
    "prefix λ\nAuthorization: Bearer [REDACTED]\r\nend\n",
  );
  expect(JSON.parse(result.stderr)).toEqual({
    request: { accessToken: "[REDACTED_JWT]" },
  });
  expect(result.stdout + result.stderr).not.toContain(jwt);
});

test("launcher module lookup stops at its cache boundary", async () => {
  const f = await fixture("console.log('isolated launcher works');");
  // An unreadable or invalid ancestor config must not be needed by the launcher.
  await writeFile(
    join(dirname(dirname(f.executable)), "package.json"),
    "invalid json",
  );
  const result = spawnSync(process.execPath, [f.executable], {
    encoding: "utf8",
    env: environment,
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("isolated launcher works\n");
  expect(result.stderr).toBe("");
});

test("overlong diagnostics are omitted through the next newline without emitting their suffix", async () => {
  const filter = new PrismOutputFilter();
  let result = "";
  filter.on("data", (data) => {
    result += data.toString();
  });
  const ended = once(filter, "end");
  filter.write("x".repeat(4 * 1024 * 1024));
  filter.write(`Bearer ${jwt}`);
  filter.end("secret-suffix\nordinary next line\n");
  await ended;
  expect(result).toBe(
    "[Prism output line omitted: exceeds diagnostic limit]\nordinary next line\n",
  );
});

test("SIGINT reaches the actual CLI and its final diagnostics remain filtered", async () => {
  const f = await fixture(`
    process.on('SIGINT',()=>{console.error('stopped Bearer ${jwt}');process.exit(130)});
    console.log('ready');
    setInterval(()=>{},1000);
  `);
  const child = spawn(process.execPath, [f.executable], {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });
  const closed = once(child, "close");
  try {
    await once(child.stdout, "data");
    child.kill("SIGINT");
    const [code] = await closed;
    expect(code).toBe(130);
    expect(stderr).toBe("stopped Bearer [REDACTED]\n");
  } finally {
    child.kill("SIGKILL");
  }
}, 10_000);
