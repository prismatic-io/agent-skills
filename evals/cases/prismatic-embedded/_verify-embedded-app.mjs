#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { generateKeyPairSync, verify } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const excluded = new Set(["node_modules", ".git", ".jj", ".npm-cache"]);
const textFile =
  /\.(?:[cm]?[jt]sx?|json|env|pem|key|txt|md|html|ya?ml)$|^\.env/;
// Throwaway keys generated or embedded by unit tests are not project secrets.
const testFile = /(?:^|[/\\])__tests__[/\\]|\.(?:test|spec)\.[cm]?[jt]sx?$/;
// A PEM block with a real body, not a documented placeholder.
const privateKeyBlock =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----\s+[A-Za-z0-9+/=\s]{200,}-----END [A-Z ]*PRIVATE KEY-----/;
const base64Run = /[A-Za-z0-9+/=]{400,}/g;
// Browser-visible names a subject might choose; the build must not embed their values.
const browserKeyVariables = [
  "PRISMATIC_SIGNING_KEY",
  "VITE_PRISMATIC_SIGNING_KEY",
  "VITE_PRISMATIC_PRIVATE_KEY",
  "VITE_SIGNING_KEY",
];
// Present in every @prismatic-io/embedded build; proves the SDK ships to the browser.
const sdkMarker = "pio__embedded";

export const organizationId = "T3JnYW5pemF0aW9uOmVtYmVkZGVkLWV2YWw=";
export const signedInUsers = [
  {
    email: "ada@acme.test",
    password: "demo-ada",
    id: "user-ada",
    customer: "tenant-acme",
  },
  {
    email: "grace@globex.test",
    password: "demo-grace",
    id: "user-grace",
    customer: "tenant-globex",
  },
];

const walk = async (directory, visit) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path, visit);
    else if (entry.isFile() && textFile.test(entry.name)) await visit(path);
  }
};

/** Whether text holds a private key as PEM, escaped-newline PEM, or base64 PEM. */
export const containsPrivateKey = (text) => {
  const unescaped = text.replaceAll("\\n", "\n");
  if (privateKeyBlock.test(unescaped)) return true;
  return [...unescaped.matchAll(base64Run)].some(([run]) =>
    privateKeyBlock.test(Buffer.from(run, "base64").toString("latin1")),
  );
};

// Plain names and simple globs from the root .gitignore, such as `.env` or `*.pem`.
const readIgnoredNames = async (root) => {
  let content = "";
  try {
    content = await readFile(join(root, ".gitignore"), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"))
    .map((line) => line.replace(/^\/|\/$/g, ""))
    .filter((line) => !line.includes("/"))
    .map(
      (line) =>
        new RegExp(
          `^${line
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replaceAll("*", ".*")
            .replaceAll("?", ".")}$`,
        ),
    );
};

/** Private keys in files source control would keep, outside unit tests. */
export const findPrivateKeys = async (root) => {
  const ignored = await readIgnoredNames(root);
  const found = [];
  await walk(root, async (path) => {
    const name = relative(root, path);
    if (testFile.test(name)) return;
    if (
      name
        .split(/[/\\]/)
        .some((part) => ignored.some((rule) => rule.test(part)))
    )
      return;
    if (containsPrivateKey(await readFile(path, "utf8"))) found.push(name);
  });
  return found;
};

/** Build output that embeds a canary signing key supplied through the environment. */
export const findBundledKey = async (root, canary) => {
  const found = [];
  const probe = canary.split("\n")[3];
  await walk(join(root, "dist"), async (path) => {
    if ((await readFile(path, "utf8")).includes(probe))
      found.push(relative(root, path));
  }).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  return found;
};

export const findJwts = (value) => {
  if (typeof value === "string")
    return /^[\w-]+\.[\w-]+\.[\w-]+$/.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(findJwts);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(findJwts);
  return [];
};

const decodeSegment = (segment) =>
  JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));

/** Decode an RS256 JWT and check its signature against a public key. */
export const verifyRs256 = (token, publicKey) => {
  const [header, payload, signature] = token.split(".");
  const decoded = {
    header: decodeSegment(header),
    claims: decodeSegment(payload),
  };
  const valid =
    decoded.header.alg === "RS256" &&
    verify(
      "RSA-SHA256",
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature, "base64url"),
    );
  return { ...decoded, valid };
};

/** Problems with a verified token's claims for one signed-in user. */
export const claimProblems = (claims, user, now = Date.now() / 1000) => {
  const problems = [];
  if (claims.sub !== user.id)
    problems.push(
      `sub ${JSON.stringify(claims.sub)} is not the signed-in user`,
    );
  if (claims.customer !== user.customer)
    problems.push(
      `customer ${JSON.stringify(claims.customer)} is not the user's tenant ${user.customer}`,
    );
  if (claims.organization !== organizationId)
    problems.push("organization does not come from PRISMATIC_ORGANIZATION_ID");
  if (typeof claims.iat !== "number" || claims.iat > now + 5)
    problems.push("iat is missing or in the future");
  if (typeof claims.exp !== "number" || claims.exp <= now)
    problems.push("exp is missing or already expired");
  if (typeof claims.iat === "number" && claims.exp <= claims.iat)
    problems.push("exp is not after iat");
  return problems;
};

const startApp = (root, env, timeoutMs) =>
  new Promise((resolvePort, reject) => {
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(new URL("./_embedded-app-harness.mjs", import.meta.url)),
        root,
      ],
      {
        cwd: root,
        env: { ...process.env, ...env },
        stdio: ["ignore", "ignore", "inherit", "ipc"],
      },
    );
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("The app did not start listening in time"));
    }, timeoutMs);
    child.on("message", (message) => {
      if (
        message?.type !== "embedded-app-ready" &&
        message?.type !== "embedded-app-error"
      )
        return;
      clearTimeout(timer);
      if (message.type === "embedded-app-error") {
        child.kill("SIGKILL");
        reject(new Error(message.error));
      } else
        resolvePort({ port: message.port, stop: () => child.kill("SIGKILL") });
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`The app exited with ${code} before listening`));
    });
  });

const requestToken = async (baseUrl, tokenPath, { cookie, spoof = false }) => {
  const spoofed = {
    customer: "tenant-spoofed",
    sub: "user-spoofed",
    organization: "spoofed-organization",
  };
  const query = spoof ? `?${new URLSearchParams(spoofed)}` : "";
  const headers = {
    ...(cookie ? { cookie } : {}),
    ...(spoof
      ? { "x-customer-id": spoofed.customer, "x-user-id": spoofed.sub }
      : {}),
  };
  let response = await fetch(`${baseUrl}${tokenPath}${query}`, { headers });
  const rejected = response.status === 401 || response.status === 403;
  const getText = await response.clone().text();
  if (!rejected && !/eyJ[\w-]+\.[\w-]+\.[\w-]+/.test(getText))
    response = await fetch(`${baseUrl}${tokenPath}${query}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(spoof ? spoofed : {}),
    });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, text, tokens: findJwts(body) };
};

const signIn = async (baseUrl, { email, password }) => {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Fixture sign-in failed for ${email}`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
};

/** Exercise the token endpoint as the signed-in fixture users would. */
export const checkTokenEndpoint = async (
  root,
  { tokenPath = "/api/prismatic/token", timeoutMs = 30_000 } = {},
) => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const problems = [];
  let app;
  try {
    app = await startApp(
      root,
      {
        PRISMATIC_SIGNING_KEY: privateKey,
        PRISMATIC_ORGANIZATION_ID: organizationId,
      },
      timeoutMs,
    );
  } catch (error) {
    return [error.message];
  }
  try {
    const baseUrl = `http://127.0.0.1:${app.port}`;
    const anonymous = await requestToken(baseUrl, tokenPath, {});
    if (anonymous.status < 400 || anonymous.tokens.length)
      problems.push(
        `An unauthenticated request received ${anonymous.status}${anonymous.tokens.length ? " and a token" : ""}`,
      );
    for (const user of signedInUsers) {
      const cookie = await signIn(baseUrl, user);
      for (const spoof of [false, true]) {
        const label = `${user.email}${spoof ? " with spoofed identity parameters" : ""}`;
        const result = await requestToken(baseUrl, tokenPath, {
          cookie,
          spoof,
        });
        if (result.text.includes("PRIVATE KEY"))
          problems.push(`${label}: the response contains a private key`);
        if (result.status >= 400 || !result.tokens.length) {
          problems.push(
            `${label}: expected a token, received ${result.status}`,
          );
          continue;
        }
        const verified = result.tokens
          .map((token) => verifyRs256(token, publicKey))
          .find(({ valid }) => valid);
        if (!verified) {
          problems.push(
            `${label}: no RS256 token verifies with PRISMATIC_SIGNING_KEY`,
          );
          continue;
        }
        problems.push(
          ...claimProblems(verified.claims, user).map(
            (problem) => `${label}: ${problem}`,
          ),
        );
      }
    }
  } finally {
    app.stop();
  }
  return problems;
};

export const verifyEmbeddedApp = async (
  root,
  { timeoutMs = 180_000, run = spawnSync, tokenPath } = {},
) => {
  const directory = resolve(root);
  const manifest = JSON.parse(
    await readFile(join(directory, "package.json"), "utf8"),
  );
  const checks = [];
  const record = (script, problems) =>
    checks.push({
      script,
      status: problems.length ? "failed" : "passed",
      error: problems.length ? problems.join("\n") : null,
    });
  const canary = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  }).privateKey;
  for (const script of ["typecheck", "lint", "test", "build"]) {
    if (!manifest.scripts?.[script]) continue;
    const env =
      script === "build"
        ? {
            ...process.env,
            ...Object.fromEntries(
              browserKeyVariables.map((name) => [name, canary]),
            ),
          }
        : process.env;
    // Keep generated checks in Lux's process group so its assertion deadline
    // and cancellation also terminate their descendants. npm.cmd needs a shell
    // on Windows; script names here are fixed, not generated command text.
    const result = run("npm", ["run", script], {
      cwd: directory,
      env,
      stdio: "inherit",
      timeout: timeoutMs,
      killSignal: "SIGKILL",
      shell: process.platform === "win32",
    });
    checks.push({
      script,
      status: result.status === 0 && !result.error ? "passed" : "failed",
      exitCode: result.status,
      signal: result.signal ?? null,
      error: result.error?.message ?? null,
    });
  }
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };
  record(
    "embedded-sdk-dependency",
    dependencies["@prismatic-io/embedded"]
      ? []
      : ["@prismatic-io/embedded is not a dependency"],
  );
  const built = checks.some(
    (check) => check.script === "build" && check.status === "passed",
  );
  if (built) {
    let bundled = false;
    await walk(join(directory, "dist"), async (path) => {
      if (
        /\.m?js$/.test(path) &&
        (await readFile(path, "utf8")).includes(sdkMarker)
      )
        bundled = true;
    }).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    record(
      "no-bundled-signing-key",
      (await findBundledKey(directory, canary)).map(
        (file) => `${file} embeds the signing key supplied at build time`,
      ),
    );
    record(
      "embedded-sdk-bundled",
      bundled ? [] : ["The built client does not include the embedded SDK"],
    );
  }
  record(
    "no-committed-private-keys",
    (await findPrivateKeys(directory)).map(
      (file) => `${file} contains a private key`,
    ),
  );
  let tokenProblems;
  try {
    tokenProblems = await checkTokenEndpoint(directory, { tokenPath });
  } catch (error) {
    tokenProblems = [error.message];
  }
  record("token-endpoint", tokenProblems);
  return {
    ok: checks.every((check) => check.status === "passed"),
    project: directory,
    checks,
  };
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(name);
    return index === -1 ? undefined : args[index + 1];
  };
  try {
    const source = resolve(option("--root") ?? ".");
    // Lux supplies a disposable verification workspace with live dependencies.
    const result = await verifyEmbeddedApp(source, {
      tokenPath: option("--token-path"),
    });
    console.log(
      JSON.stringify(
        { diagnostic: "local-embedded-checks", ...result, project: source },
        null,
        2,
      ),
    );
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
