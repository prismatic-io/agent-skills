import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const legacy = (name: string, file: string) =>
  new URL(
    `../../fixtures/migrations/${name}/input/legacy/${file}`,
    import.meta.url,
  );
const webhook = await import(
  legacy("bespoke-webhook-inbox", "server.mjs").href
);
const worker = await import(legacy("bespoke-queue-worker", "worker.mjs").href);
const secret = "local-test-secret";
const now = 1_790_000_000_000;
const raw = Buffer.from('{ "id": "evt-1", "type": "changed" }\n');
const sign = (
  body: Buffer,
  timestamp = String(now / 1000),
  delivery = "delivery/1",
) => ({
  "x-event-time": timestamp,
  "x-delivery-id": delivery,
  "x-event-signature": createHmac("sha256", secret)
    .update(`${timestamp}.${delivery}.`)
    .update(body)
    .digest("hex"),
});
const withDirectory = async (check: (directory: string) => Promise<void>) => {
  const directory = await mkdtemp(join(tmpdir(), "legacy-formats-"));
  try {
    await check(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

test("signed webhook authenticates raw bytes and rejects bad time or identity without inbox effects", async () => {
  await withDirectory(async (inbox) => {
    const options = { secret, inbox, now };
    const headers = sign(raw);
    const altered = Buffer.from(JSON.stringify(JSON.parse(raw.toString())));
    assert.equal(
      (await webhook.acceptDelivery(altered, headers, options)).status,
      401,
    );
    for (const time of [now / 1000 - 301, now / 1000 + 301])
      assert.equal(
        (await webhook.acceptDelivery(raw, sign(raw, String(time)), options))
          .status,
        401,
      );
    assert.equal(
      (
        await webhook.acceptDelivery(
          raw,
          { ...headers, "x-delivery-id": "other" },
          options,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await webhook.acceptDelivery(
          raw,
          { ...headers, "x-event-signature": "bad" },
          options,
        )
      ).status,
      401,
    );
    assert.deepEqual(await readdir(inbox), []);
  });
});

test("signed webhook stores once before ack and does not replace an accepted delivery", async () => {
  await withDirectory(async (inbox) => {
    const options = { secret, inbox, now };
    assert.equal(
      (await webhook.acceptDelivery(raw, sign(raw), options)).status,
      202,
    );
    const files = await readdir(inbox);
    assert.equal(files.length, 1);
    const original = await readFile(join(inbox, files[0]), "utf8");
    assert.deepEqual(JSON.parse(original), {
      delivery: "delivery/1",
      event: { id: "evt-1", type: "changed" },
    });
    const retry = Buffer.from('{"id":"different","type":"changed"}');
    assert.equal(
      (
        await webhook.acceptDelivery(
          retry,
          sign(retry, String(now / 1000 + 10)),
          options,
        )
      ).status,
      202,
    );
    assert.deepEqual(await readdir(inbox), files);
    assert.equal(await readFile(join(inbox, files[0]), "utf8"), original);
  });
});

test("webhook rejects authenticated malformed payload and propagates inbox failures before ack", async () => {
  await withDirectory(async (directory) => {
    const invalid = Buffer.from("{oops");
    assert.equal(
      (
        await webhook.acceptDelivery(invalid, sign(invalid), {
          secret,
          inbox: directory,
          now,
        })
      ).status,
      400,
    );
    const blocked = join(directory, "not-a-directory");
    await writeFile(blocked, "occupied");
    await assert.rejects(() =>
      webhook.acceptDelivery(raw, sign(raw), { secret, inbox: blocked, now }),
    );
  });
});

const runCsv = async (directory: string, contents: string) => {
  const source = join(directory, "input.csv");
  const accepted = join(directory, "accepted.jsonl");
  const rejected = join(directory, "rejected.jsonl");
  await writeFile(source, contents);
  const result = spawnSync(
    "python3",
    [
      fileURLToPath(legacy("bespoke-settlement-csv", "import_settlements.py")),
      source,
      accepted,
      rejected,
    ],
    { encoding: "utf8" },
  );
  assert.ifError(result.error);
  const lines = async (path: string) =>
    (await readFile(path, "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  return {
    status: result.status,
    stderr: result.stderr,
    accepted: await lines(accepted),
    rejected: await lines(rejected),
  };
};

test("CSV conversion preserves precise cents, quoted records, leading zeros and reject line positions", async () => {
  await withDirectory(async (directory) => {
    const sample = await readFile(
      legacy("bespoke-settlement-csv", "settlements.csv"),
      "utf8",
    );
    const result = await runCsv(directory, `\uFEFF${sample}`);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.accepted, [
      {
        settlementId: "000184",
        merchantId: "0072",
        amountMinor: "12450",
        currency: "USD",
        memo: "Payout, weekly",
      },
      {
        settlementId: "000185",
        merchantId: "0072",
        amountMinor: "-425",
        currency: "USD",
        memo: "Refund\nprocessed",
      },
      {
        settlementId: "000187",
        merchantId: "0090",
        amountMinor: "9007199254740993",
        currency: "USD",
        memo: "Consolidated historical balance",
      },
    ]);
    assert.equal(result.rejected.length, 1);
    assert.equal(result.rejected[0].endingLine, 5);
    assert.equal(result.rejected[0].row.amount, "1.005");
  });
});

test("CSV bad headers fail while nonfinite and invalid currency rows reject and later zero survives", async () => {
  await withDirectory(async (directory) => {
    const invalid = await runCsv(directory, "settlement_id,amount\na,1\n");
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Missing required CSV headers/);
    const result = await runCsv(
      directory,
      "settlement_id,merchant_id,amount,currency,memo\na,m,NaN,USD,nan\nb,m,1,GBP,currency\nc,m,0.00,EUR,zero\n",
    );
    assert.equal(result.status, 0);
    assert.deepEqual(
      result.rejected.map((row) => row.endingLine),
      [2, 3],
    );
    assert.equal(result.accepted[0].amountMinor, "0");
  });
});

test("CSV source accepts finite decimal lexical forms without changing record classification", async () => {
  await withDirectory(async (directory) => {
    const result = await runCsv(
      directory,
      "settlement_id,merchant_id,amount,currency,memo\na,m,+1.25,USD,plus\nb,m, 1.25 ,USD,spaces\nc,m,1e2,USD,exponent\nd,m,.50,USD,fraction\n",
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.rejected, []);
    assert.deepEqual(
      result.accepted.map(({ settlementId, amountMinor }) => ({
        settlementId,
        amountMinor,
      })),
      [
        { settlementId: "a", amountMinor: "125" },
        { settlementId: "b", amountMinor: "125" },
        { settlementId: "c", amountMinor: "10000" },
        { settlementId: "d", amountMinor: "50" },
      ],
    );
  });
});

const config = {
  queueUrl: "https://queue.example.invalid",
  queueToken: "queue-token",
  crmUrl: "https://crm.example.invalid",
  crmToken: "crm-token",
};
type Call = { url: URL; options: RequestInit };
const queueRun = async (messages: unknown[], statuses: number[]) => {
  const calls: Call[] = [];
  const request = async (url: URL, options: RequestInit) => {
    calls.push({ url, options });
    if (calls.length === 1) return new Response(JSON.stringify({ messages }));
    return new Response(null, { status: statuses.shift() ?? 204 });
  };
  let failure: unknown;
  try {
    await worker.drainOnce(config, request);
  } catch (error) {
    failure = error;
  }
  return { calls, failure };
};
const leased = JSON.parse(
  await readFile(
    legacy("bespoke-queue-worker", "leased-messages.json"),
    "utf8",
  ),
).messages;

test("queue worker uses distinct credentials, current receipts and stable event keys in effect order", async () => {
  const { calls, failure } = await queueRun(leased, []);
  assert.equal(failure, undefined);
  assert.deepEqual(
    calls.map(({ url, options }) => [
      options.method ?? "GET",
      url.pathname + url.search,
    ]),
    [
      ["GET", "/messages?limit=10"],
      ["PUT", "/customers/account%2F0041"],
      ["DELETE", "/messages/lease%2F814%2Ba"],
      ["PUT", "/customers/account%2F0042"],
      ["DELETE", "/messages/lease%2F815%2Bb"],
    ],
  );
  assert.deepEqual(JSON.parse(String(calls[1].options.body)), {
    email: "billing@example.invalid",
    active: false,
  });
  for (const [index, { options }] of calls.entries()) {
    const headers = new Headers(options.headers);
    assert.equal(
      headers.get("Authorization"),
      `Bearer ${index === 1 || index === 3 ? "crm-token" : "queue-token"}`,
    );
  }
  assert.equal(
    new Headers(calls[1].options.headers).get("Idempotency-Key"),
    "change-192",
  );
});

test("queue second CRM failure leaves prior ack committed and does not ack failed message", async () => {
  const { calls, failure } = await queueRun(
    [...leased, leased[0]],
    [204, 204, 503],
  );
  assert.match(String(failure), /CRM failed: 503/);
  assert.equal(calls.length, 4);
  assert.equal(calls[2].options.method, "DELETE");
  assert.equal(calls[3].options.method, "PUT");
});

test("queue ack failure replays stable event key with a new lease receipt", async () => {
  const first = await queueRun(leased, [204, 409]);
  assert.match(String(first.failure), /Acknowledgement failed: 409/);
  assert.equal(first.calls.length, 3);
  const retry = await queueRun(
    [{ ...leased[0], receipt: "new/receipt+2" }],
    [],
  );
  assert.equal(retry.failure, undefined);
  assert.equal(
    new Headers(retry.calls[1].options.headers).get("Idempotency-Key"),
    new Headers(first.calls[1].options.headers).get("Idempotency-Key"),
  );
  assert.equal(retry.calls[2].url.pathname, "/messages/new%2Freceipt%2B2");
});

test("queue lease failure does not attempt a destination write", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      worker.drainOnce(config, async () => {
        calls++;
        return new Response(null, { status: 401 });
      }),
    /Lease failed: 401/,
  );
  assert.equal(calls, 1);
});
