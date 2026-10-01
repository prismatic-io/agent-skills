import assert from "node:assert/strict";
import { resolve } from "node:path";
import { beforeEach, test, vi } from "vitest";

const nativeExec = vi.hoisted(() => vi.fn());
vi.mock("@prismatic-io/lux", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  exec: nativeExec,
}));

import config from "./lux.config.ts";
import { prismBin } from "./prism.ts";

const setupSuite = config.lifecycleFixtures?.[0]?.setupSuite;
assert.ok(setupSuite);
const abortSignal = new AbortController().signal;
const context = {
  suiteId: "session-policy-test",
  suiteDir: "/tmp/session-policy-test",
  runsRoot: "/tmp",
  concurrency: 1,
  items: [],
  abortSignal,
};
const session = (endpointUrl: string) => ({
  exitCode: 0,
  timedOut: false,
  stdout: JSON.stringify({
    endpointUrl,
    organization: { name: "Existing development organization" },
  }),
});

beforeEach(() => {
  nativeExec.mockReset();
});

for (const endpoint of [
  "https://app.rwersal.prismatic-dev.io",
  "https://prismatic-dev.io",
]) {
  test(`native suite preflight accepts existing dev session ${endpoint}`, async () => {
    nativeExec.mockResolvedValue(session(endpoint));
    await setupSuite(context);
    assert.equal(nativeExec.mock.calls.length, 1);
    const [executable, args, options] = nativeExec.mock.calls[0];
    assert.equal(executable, process.execPath);
    assert.deepEqual(args, [
      resolve(prismBin, "prism"),
      "me",
      "--format",
      "json",
    ]);
    assert.equal(options.signal, abortSignal);
    assert.equal(options.timeoutMs, 60_000);
  });
}

for (const endpoint of [
  "https://app.prismatic.io",
  "http://app.rwersal.prismatic-dev.io",
  "https://evilprismatic-dev.io",
  "https://prismatic-dev.io.example.com",
  "https://prismatic-dev.io@production.example.com",
]) {
  test(`native suite preflight rejects unsafe endpoint ${endpoint}`, async () => {
    nativeExec.mockResolvedValue(session(endpoint));
    await assert.rejects(
      async () => setupSuite(context),
      /requires a prismatic-dev.io session/,
    );
  });
}

for (const result of [
  { ...session("https://app.rwersal.prismatic-dev.io"), exitCode: 1 },
  { ...session("https://app.rwersal.prismatic-dev.io"), timedOut: true },
  { ...session("https://app.rwersal.prismatic-dev.io"), stdout: "not JSON" },
  { ...session("https://app.rwersal.prismatic-dev.io"), stdout: "{}" },
]) {
  test(`native suite preflight fails closed on unusable identity ${JSON.stringify(result)}`, async () => {
    nativeExec.mockResolvedValue(result);
    await assert.rejects(async () => setupSuite(context));
  });
}

test("native session command errors prevent suite setup", async () => {
  nativeExec.mockImplementation(async () => {
    throw new Error("session unavailable");
  });
  await assert.rejects(async () => setupSuite(context), /session unavailable/);
});

test("drivers and every profile omit Prism read-only policy", () => {
  assert.doesNotMatch(JSON.stringify(config), /PRISM_READ_ONLY/);
  assert.deepEqual(Object.keys(config.profiles ?? {}).sort(), [
    "claude-code",
    "codex",
  ]);
});
