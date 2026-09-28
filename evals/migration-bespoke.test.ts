import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const script = fileURLToPath(
  new URL(
    "./fixtures/migrations/bespoke-order-sync/input/legacy/order-sync.mjs",
    import.meta.url,
  ),
);
const initialCursor = "opaque/start+0";
const order = (id: string, status = "paid") => ({
  id,
  status,
  currency: "USD",
  customer: { email: " Accounts@Example.invalid " },
  items: [
    { sku: "A", quantity: 3, unit_price_cents: 1099 },
    { sku: "GIFT", quantity: 1, unit_price_cents: 0 },
  ],
});
const first = "shop/A";
const second = "shop/B";
const pageCursor = "opaque/page+1";
const finalCursor = "opaque/end+2";
type Attempt = { id: string; payload: unknown };

const withLegacy = async (
  runTest: (harness: {
    run: () => Promise<{ code: number | null; stderr: string }>;
    checkpoint: () => Promise<string>;
    corruptCheckpoint: () => Promise<void>;
    attempts: Attempt[];
    reads: string[];
    setResponses: (statuses: number[]) => void;
    addFirstPageOrder: () => void;
  }) => Promise<void>,
  sourceOverride?: string,
) => {
  const directory = await mkdtemp(join(tmpdir(), "legacy-order-sync-"));
  const executable =
    sourceOverride === undefined ? script : join(directory, "order-sync.mjs");
  if (sourceOverride !== undefined) await writeFile(executable, sourceOverride);
  const statePath = join(directory, "cursor.json");
  const attempts: Attempt[] = [];
  const reads: string[] = [];
  const protocolErrors: string[] = [];
  let statuses: number[] = [];
  let extraFirstPageOrder = false;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/changes") {
      if (request.headers.authorization !== "Bearer source-test-secret")
        protocolErrors.push("wrong source credential");
      const cursor = url.searchParams.get("after") ?? "";
      reads.push(cursor);
      if (![initialCursor, pageCursor, finalCursor].includes(cursor)) {
        response.writeHead(400).end();
        return;
      }
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify(
          cursor === initialCursor
            ? {
                orders: [
                  order(first),
                  order("ignored", "pending"),
                  ...(extraFirstPageOrder ? [order("shop/extra")] : []),
                ],
                next_cursor: pageCursor,
                has_more: true,
              }
            : {
                orders:
                  cursor === pageCursor
                    ? [order(second), order("cancelled", "cancelled")]
                    : [],
                next_cursor:
                  cursor === pageCursor ? finalCursor : "opaque/empty+3",
                has_more: false,
              },
        ),
      );
      return;
    }
    if (request.method !== "PUT")
      protocolErrors.push("destination must use PUT");
    if (request.headers.authorization !== "Bearer destination-test-secret")
      protocolErrors.push("wrong destination credential");
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    if (url.pathname !== `/orders/${encodeURIComponent(payload.externalId)}`)
      protocolErrors.push("order ID must be one encoded path segment");
    attempts.push({
      id: decodeURIComponent(url.pathname.slice("/orders/".length)),
      payload,
    });
    const status = statuses.shift() ?? 204;
    response.setHeader("Retry-After", "0");
    response.writeHead(status).end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await runTest({
      attempts,
      reads,
      addFirstPageOrder: () => {
        extraFirstPageOrder = true;
      },
      setResponses: (value) => {
        statuses = value;
      },
      checkpoint: async () =>
        JSON.parse(await readFile(statePath, "utf8")).cursor,
      corruptCheckpoint: async () => writeFile(statePath, "broken-json"),
      run: async () => {
        const child = spawn(process.execPath, [executable], {
          env: {
            PATH: process.env.PATH,
            ORDER_FEED_URL: baseUrl,
            FULFILLMENT_URL: baseUrl,
            ORDER_FEED_TOKEN: "source-test-secret",
            FULFILLMENT_TOKEN: "destination-test-secret",
            CURSOR_FILE: statePath,
            INITIAL_CURSOR: initialCursor,
          },
          stdio: ["ignore", "ignore", "pipe"],
        });
        let stderr = "";
        child.stderr.on("data", (data) => {
          stderr += data;
        });
        return new Promise((resolve, reject) => {
          child.on("error", reject);
          child.on("close", (code) => resolve({ code, stderr }));
        });
      },
    });
    assert.deepEqual(protocolErrors, []);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
};

test("legacy fixture pages, filters, preserves money units, and resumes from final cursor", async () => {
  await withLegacy(async ({ run, attempts, reads, checkpoint }) => {
    assert.equal((await run()).code, 0);
    assert.deepEqual(reads, [initialCursor, pageCursor]);
    assert.deepEqual(
      attempts,
      [first, second].map((id) => ({
        id,
        payload: {
          externalId: id,
          customerEmail: "accounts@example.invalid",
          currency: "USD",
          lines: [
            { sku: "A", quantity: 3, unitPriceCents: 1099 },
            { sku: "GIFT", quantity: 1, unitPriceCents: 0 },
          ],
        },
      })),
    );
    assert.equal(await checkpoint(), finalCursor);
    assert.equal((await run()).code, 0);
    assert.equal(reads.at(-1), finalCursor);
    assert.equal(attempts.length, 2);
    assert.equal(await checkpoint(), "opaque/empty+3");
  });
});

test("HTTP oracle rejects an unencoded order ID even when its decoded value matches", async () => {
  const original = await readFile(script, "utf8");
  const mutation = original.replace("encodeURIComponent(order.id)", "order.id");
  assert.notEqual(mutation, original);
  await assert.rejects(
    () =>
      withLegacy(async ({ run }) => {
        assert.equal((await run()).code, 0);
      }, mutation),
    /order ID must be one encoded path segment/,
  );
});

test("legacy fixture retries only transient responses and bounds attempts", async () => {
  await withLegacy(async ({ run, attempts, checkpoint, setResponses }) => {
    setResponses([429, 503, 204]);
    assert.equal((await run()).code, 0);
    assert.deepEqual(
      attempts.map(({ id }) => id),
      [first, first, first, second],
    );
    assert.equal(await checkpoint(), finalCursor);
  });
  await withLegacy(async ({ run, attempts, checkpoint, setResponses }) => {
    setResponses([503, 503, 503]);
    assert.equal((await run()).code, 1);
    assert.equal(attempts.length, 3);
    await assert.rejects(checkpoint, { code: "ENOENT" });
  });
});

test("legacy fixture retains completed pages after a later permanent failure", async () => {
  await withLegacy(
    async ({ run, attempts, reads, checkpoint, setResponses }) => {
      setResponses([204, 422]);
      const failed = await run();
      assert.equal(failed.code, 1);
      assert.match(failed.stderr, /HTTP 422/);
      assert.equal(await checkpoint(), pageCursor);
      assert.equal((await run()).code, 0);
      assert.deepEqual(reads, [initialCursor, pageCursor, pageCursor]);
      assert.deepEqual(
        attempts.map(({ id }) => id),
        [first, second, second],
      );
      assert.equal(await checkpoint(), finalCursor);
    },
  );
});

test("malformed JSON checkpoint does not silently start over", async () => {
  await withLegacy(async ({ run, corruptCheckpoint, reads, attempts }) => {
    await corruptCheckpoint();
    assert.equal((await run()).code, 1);
    assert.deepEqual(reads, []);
    assert.deepEqual(attempts, []);
  });
});

test("a partial page replays successful idempotent writes before advancing", async () => {
  await withLegacy(
    async ({
      run,
      addFirstPageOrder,
      setResponses,
      checkpoint,
      attempts,
      reads,
    }) => {
      addFirstPageOrder();
      setResponses([204, 401]);
      assert.equal((await run()).code, 1);
      await assert.rejects(checkpoint, { code: "ENOENT" });
      assert.deepEqual(
        attempts.map(({ id }) => id),
        [first, "shop/extra"],
      );
      assert.equal((await run()).code, 0);
      assert.deepEqual(reads, [initialCursor, initialCursor, pageCursor]);
      assert.deepEqual(
        attempts.map(({ id }) => id),
        [first, "shop/extra", first, "shop/extra", second],
      );
      assert.deepEqual(attempts[0], attempts[2]);
      assert.equal(await checkpoint(), finalCursor);
    },
  );
});
