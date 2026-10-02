import assert from "node:assert/strict";
import type { spawnSync } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import {
  checkTokenEndpoint,
  claimProblems,
  containsPrivateKey,
  findBundledKey,
  findJwts,
  findPrivateKeys,
  organizationId,
  signedInUsers,
  verifyEmbeddedApp,
  verifyRs256,
} from "./_verify-embedded-app.mjs";

const keys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const encode = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const signToken = (
  claims: object,
  privateKey: string = keys.privateKey,
  header: object = { alg: "RS256", typ: "JWT" },
) => {
  const unsigned = `${encode(header)}.${encode(claims)}`;
  return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url")}`;
};
const [ada] = signedInUsers;
const now = 1_800_000_000;
const validClaims = {
  sub: "user-ada",
  organization: organizationId,
  customer: "tenant-acme",
  iat: now - 60,
  exp: now + 600,
};

const workspace = async (fn: (root: string) => Promise<void>) => {
  const root = await mkdtemp(join(tmpdir(), "embedded-check-test-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

// A dependency-free stand-in for the fixture's createApp() contract.
const fakeApp = (tokenLogic: string) => `
import { createSign, randomUUID } from "node:crypto";
const users = {
  "ada@acme.test": { id: "user-ada", tenantId: "tenant-acme", password: "demo-ada" },
  "grace@globex.test": { id: "user-grace", tenantId: "tenant-globex", password: "demo-grace" },
};
const sessions = new Map();
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const signToken = (claims) => {
  const unsigned = encode({ alg: "RS256", typ: "JWT" }) + "." + encode(claims);
  return unsigned + "." + createSign("RSA-SHA256").update(unsigned).sign(process.env.PRISMATIC_SIGNING_KEY, "base64url");
};
const readBody = async (request) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
};
export const createApp = () => async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const send = (status, body, headers = {}) => {
    response.writeHead(status, { "Content-Type": "application/json", ...headers });
    response.end(body === undefined ? "" : JSON.stringify(body));
  };
  if (url.pathname === "/api/login") {
    const { email, password } = await readBody(request);
    const user = users[email];
    if (!user || user.password !== password) return send(401, { error: "invalid" });
    const sid = randomUUID();
    sessions.set(sid, user);
    return send(204, undefined, { "Set-Cookie": "sid=" + sid + "; HttpOnly" });
  }
  if (url.pathname === "/api/prismatic/token") {
    const sid = request.headers.cookie?.match(/sid=([^;]+)/)?.[1];
    const user = sessions.get(sid);
    const now = Math.floor(Date.now() / 1000);
    ${tokenLogic}
  }
  send(404, { error: "not found" });
};
`;
const writeFakeApp = async (root: string, tokenLogic: string) => {
  await mkdir(join(root, "server"), { recursive: true });
  await writeFile(join(root, "server", "app.ts"), fakeApp(tokenLogic));
};
const sessionToken = `
    if (!user) return send(401, { error: "Sign in required" });
    return send(200, { token: signToken({ sub: user.id, customer: user.tenantId, organization: process.env.PRISMATIC_ORGANIZATION_ID, iat: now - 60, exp: now + 600 }), expiresAt: now + 600 });`;

test("finds tokens anywhere in a JSON response", () => {
  assert.deepEqual(findJwts({ data: { jwt: "a.b.c" }, list: ["x", "d.e.f"] }), [
    "a.b.c",
    "d.e.f",
  ]);
  assert.deepEqual(findJwts("not a token"), []);
});

test("verifies RS256 signatures with the matching public key only", () => {
  const token = signToken(validClaims);
  assert.equal(verifyRs256(token, keys.publicKey).valid, true);
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  assert.equal(verifyRs256(token, other.publicKey).valid, false);
  const hs256 = signToken(validClaims, keys.privateKey, { alg: "HS256" });
  assert.equal(verifyRs256(hs256, keys.publicKey).valid, false);
});

test("accepts session claims and names each wrong claim", () => {
  assert.deepEqual(claimProblems(validClaims, ada, now), []);
  assert.deepEqual(
    claimProblems({ ...validClaims, sub: ada.email }, ada, now),
    [`sub ${JSON.stringify(ada.email)} is not the signed-in user`],
  );
  const problems = claimProblems(
    {
      sub: "user-grace",
      customer: "tenant-globex",
      organization: "other",
      iat: now + 60,
      exp: now - 1,
    },
    ada,
    now,
  );
  assert.equal(problems.length, 6);
});

test("recognizes private keys in PEM, escaped-newline, and base64 forms", () => {
  assert.equal(containsPrivateKey(keys.privateKey), true);
  assert.equal(
    containsPrivateKey(
      `PRISMATIC_SIGNING_KEY="${keys.privateKey.replaceAll("\n", "\\n")}"`,
    ),
    true,
  );
  assert.equal(
    containsPrivateKey(Buffer.from(keys.privateKey).toString("base64")),
    true,
  );
  assert.equal(containsPrivateKey(keys.publicKey), false);
  assert.equal(
    containsPrivateKey(
      "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----",
    ),
    false,
  );
});

test("reports kept private keys but allows unit tests and ignored files", async () =>
  workspace(async (root) => {
    await mkdir(join(root, "server", "fixtures"), { recursive: true });
    await writeFile(join(root, "server", "key.ts"), keys.privateKey);
    await writeFile(
      join(root, "server", "fixtures", "private.pem"),
      keys.privateKey,
    );
    await writeFile(join(root, "server", "token.test.ts"), keys.privateKey);
    await writeFile(join(root, ".gitignore"), "node_modules/\n.env\n");
    await writeFile(
      join(root, ".env"),
      `PRISMATIC_SIGNING_KEY="${keys.privateKey}"`,
    );
    await writeFile(
      join(root, ".env.example"),
      "PRISMATIC_SIGNING_KEY=-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\n",
    );
    await mkdir(join(root, "node_modules", "dep"), { recursive: true });
    await writeFile(
      join(root, "node_modules", "dep", "key.js"),
      keys.privateKey,
    );
    assert.deepEqual((await findPrivateKeys(root)).sort(), [
      join("server", "fixtures", "private.pem"),
      join("server", "key.ts"),
    ]);
  }));

test("reports build output that embeds a build-time key", async () =>
  workspace(async (root) => {
    await mkdir(join(root, "dist", "assets"), { recursive: true });
    await writeFile(
      join(root, "dist", "assets", "index.js"),
      `const key = ${JSON.stringify(keys.privateKey)};`,
    );
    await writeFile(join(root, "dist", "assets", "other.js"), "const x = 1;");
    assert.deepEqual(await findBundledKey(root, keys.privateKey), [
      join("dist", "assets", "index.js"),
    ]);
  }));

test("allows client guidance and decode-only JWT use while retaining security probes", async () =>
  workspace(async (root) => {
    await writeFakeApp(root, sessionToken);
    await mkdir(join(root, "client"));
    await mkdir(join(root, "dist"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        dependencies: { "@prismatic-io/embedded": "1.0.0" },
        scripts: { build: "fixture build" },
      }),
    );
    await writeFile(
      join(root, "client", "session.ts"),
      `
// Signing stays on the backend; never use jwt.sign or VITE_PRISMATIC_SIGNING_KEY here.
import jwt from "jsonwebtoken";
export const expiry = (token) => jwt.decode(token)?.exp;
`,
    );
    await writeFile(
      join(root, "dist", "index.js"),
      'const sdkClass = "pio__embedded";',
    );
    const run = (() => ({ status: 0 })) as unknown as typeof spawnSync;
    const result = await verifyEmbeddedApp(root, { run });
    assert.equal(result.ok, true, JSON.stringify(result.checks));
    for (const name of [
      "no-committed-private-keys",
      "no-bundled-signing-key",
      "token-endpoint",
    ])
      assert.equal(
        result.checks.find(({ script }) => script === name)?.status,
        "passed",
      );
    await writeFile(
      join(root, "client", "key.ts"),
      `export const key = ${JSON.stringify(keys.privateKey)};`,
    );
    const exposed = await verifyEmbeddedApp(root, { run });
    assert.equal(exposed.ok, false);
    assert.equal(
      exposed.checks.find(
        ({ script }) => script === "no-committed-private-keys",
      )?.status,
      "failed",
    );
  }));

test("passes an endpoint that signs session identity", async () =>
  workspace(async (root) => {
    await writeFakeApp(root, sessionToken);
    assert.deepEqual(await checkTokenEndpoint(root), []);
  }));

test("fails an endpoint that trusts browser-supplied identity", async () =>
  workspace(async (root) => {
    await writeFakeApp(
      root,
      `
    if (!user) return send(401, { error: "Sign in required" });
    const customer = url.searchParams.get("customer") ?? user.tenantId;
    return send(200, { token: signToken({ sub: user.id, customer, organization: process.env.PRISMATIC_ORGANIZATION_ID, iat: now, exp: now + 600 }) });`,
    );
    const problems = await checkTokenEndpoint(root);
    assert.equal(problems.length, 2);
    assert.ok(problems.every((problem) => problem.includes("spoofed")));
  }));

test("fails an endpoint that serves tokens without a session", async () =>
  workspace(async (root) => {
    await writeFakeApp(
      root,
      `
    return send(200, { token: signToken({ sub: user?.id ?? "anonymous", customer: user?.tenantId ?? "tenant-acme", organization: process.env.PRISMATIC_ORGANIZATION_ID, iat: now, exp: now + 600 }) });`,
    );
    const problems = await checkTokenEndpoint(root);
    assert.match(problems[0], /unauthenticated request received 200/);
  }));

test("application JSON logs and partial stdout cannot become readiness messages", async () =>
  workspace(async (root) => {
    await mkdir(join(root, "server"), { recursive: true });
    await writeFile(
      join(root, "server", "app.ts"),
      `console.log(JSON.stringify({ port: 1, error: "ordinary application log" }));
process.stdout.write('{"partial":');
await new Promise((resolve) => setTimeout(resolve, 10));
process.stdout.write('true}\\n{"incomplete":');
${fakeApp(sessionToken)}`,
    );
    assert.deepEqual(await checkTokenEndpoint(root), []);
  }));

test("reports an app that cannot start", async () =>
  workspace(async (root) => {
    await mkdir(join(root, "server"), { recursive: true });
    await writeFile(
      join(root, "server", "app.ts"),
      "export const other = 1;\n",
    );
    const [problem] = await checkTokenEndpoint(root);
    assert.match(problem, /no longer exports createApp/);
  }));

test("runs available scripts and requires the embedded SDK", async () =>
  workspace(async (root) => {
    await writeFakeApp(root, sessionToken);
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ scripts: { test: "exit 0", build: "exit 0" } }),
    );
    const scripts: string[] = [];
    const run = ((_command: string, args: string[]) => {
      scripts.push(args[1]);
      return { status: 0 };
    }) as unknown as typeof spawnSync;
    const result = await verifyEmbeddedApp(root, { run });
    assert.deepEqual(scripts, ["test", "build"]);
    const statuses = Object.fromEntries(
      result.checks.map((check) => [check.script, check.status]),
    );
    assert.equal(statuses["embedded-sdk-dependency"], "failed");
    assert.equal(statuses["embedded-sdk-bundled"], "failed");
    assert.equal(statuses["token-endpoint"], "passed");
    assert.equal(result.ok, false);
  }));
