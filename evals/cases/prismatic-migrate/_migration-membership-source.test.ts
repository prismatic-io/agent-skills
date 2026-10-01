import assert from "node:assert/strict";
import { test } from "vitest";

const { reconcile } = await import(
  new URL(
    "../../fixtures/migrations/bespoke-membership-reconcile/input/legacy/reconcile.mjs",
    import.meta.url,
  ).href
);
const config = {
  directoryUrl: "https://directory.invalid",
  directoryToken: "directory-test-token",
  accessUrl: "https://access.invalid",
  accessToken: "access-test-token",
  group: "training/eu +",
};
const member = (id: string, enabled: unknown = true, kind = "employee") => ({
  id,
  enabled,
  kind,
});
type Grant = { personId: string; managedBy: string };
const gateway = (
  pages: Record<string, unknown>,
  grants: Grant[],
  fail?: (method: string, id: string) => boolean,
) => {
  const calls: { method: string; url: URL; body?: string }[] = [];
  const state = new Map(grants.map((grant) => [grant.personId, grant]));
  const fetcher = async (
    url: URL,
    init: { method: string; headers: Record<string, string>; body?: string },
  ) => {
    calls.push({ method: init.method, url, body: init.body });
    assert.equal(
      init.headers.authorization,
      `Bearer ${url.host === "directory.invalid" ? config.directoryToken : config.accessToken}`,
    );
    assert.equal(url.pathname.split("/")[3], encodeURIComponent(config.group));
    if (url.host === "directory.invalid") {
      const page = pages[url.searchParams.get("cursor") ?? "first"];
      return page === undefined
        ? new Response("unavailable", { status: 503 })
        : Response.json(page);
    }
    if (init.method === "GET")
      return Response.json({ grants: [...state.values()] });
    const id = decodeURIComponent(url.pathname.split("/")[5]);
    if (fail?.(init.method, id))
      return new Response("unavailable", { status: 503 });
    if (init.method === "PUT")
      state.set(id, { personId: id, ...JSON.parse(init.body ?? "{}") });
    else if (init.method === "DELETE") state.delete(id);
    else throw new Error(`Unexpected method ${init.method}`);
    return new Response(null, { status: 204 });
  };
  return { fetcher, calls, state };
};
const writes = (mock: ReturnType<typeof gateway>) =>
  mock.calls.filter((call) => call.method !== "GET");
test("complete pages preserve exact eligibility and identities without taking over manual grants", async () => {
  const mock = gateway(
    {
      first: {
        members: [
          member("manual"),
          member("Case/1"),
          member("off", false),
          member("contract", true, "contractor"),
        ],
        nextCursor: "page+/=2",
      },
      "page+/=2": {
        members: [member("Case/1"), member("case/1"), member("truthy", "true")],
        nextCursor: null,
      },
    },
    [
      { personId: "manual", managedBy: "helpdesk" },
      { personId: "exception", managedBy: "helpdesk" },
      { personId: "stale", managedBy: "directory-bridge" },
    ],
  );
  assert.deepEqual(await reconcile(config, mock.fetcher), {
    added: 2,
    removed: 1,
  });
  assert.deepEqual(
    [...mock.state.values()],
    [
      { personId: "manual", managedBy: "helpdesk" },
      { personId: "exception", managedBy: "helpdesk" },
      { personId: "Case/1", managedBy: "directory-bridge" },
      { personId: "case/1", managedBy: "directory-bridge" },
    ],
  );
  assert.deepEqual(
    writes(mock).map((call) => call.method),
    ["PUT", "PUT", "DELETE"],
  );
  assert.equal(mock.calls[1].url.search, "?cursor=page%2B%2F%3D2");
  assert.ok(writes(mock)[0].url.pathname.endsWith("Case%2F1"));
});
test("failed later snapshot page causes no access reads or writes", async () => {
  const mock = gateway(
    { first: { members: [member("new")], nextCursor: "missing" } },
    [{ personId: "old", managedBy: "directory-bridge" }],
  );
  await assert.rejects(reconcile(config, mock.fetcher), /503/);
  assert.equal(mock.calls.length, 2);
  assert.ok(mock.calls.every((call) => call.url.host === "directory.invalid"));
  assert.deepEqual([...mock.state.keys()], ["old"]);
});
test("complete empty snapshot revokes bridge grants and preserves manual exceptions", async () => {
  const mock = gateway({ first: { members: [], nextCursor: null } }, [
    { personId: "old", managedBy: "directory-bridge" },
    { personId: "exception", managedBy: "helpdesk" },
  ]);
  assert.deepEqual(await reconcile(config, mock.fetcher), {
    added: 0,
    removed: 1,
  });
  assert.deepEqual([...mock.state.keys()], ["exception"]);
});
test("failed add preserves prior success and postpones all removals; next run converges", async () => {
  let unavailable = true;
  const mock = gateway(
    {
      first: { members: [member("first"), member("second")], nextCursor: null },
    },
    [
      { personId: "old", managedBy: "directory-bridge" },
      { personId: "manual", managedBy: "helpdesk" },
    ],
    (method, id) => unavailable && method === "PUT" && id === "second",
  );
  await assert.rejects(reconcile(config, mock.fetcher), /503/);
  assert.deepEqual([...mock.state.keys()], ["old", "manual", "first"]);
  assert.deepEqual(
    writes(mock).map((call) => call.method),
    ["PUT", "PUT"],
  );
  unavailable = false;
  mock.calls.length = 0;
  assert.deepEqual(await reconcile(config, mock.fetcher), {
    added: 1,
    removed: 1,
  });
  assert.deepEqual([...mock.state.keys()], ["manual", "first", "second"]);
  assert.equal(
    writes(mock).filter((call) => call.url.pathname.endsWith("/first")).length,
    0,
  );
});
test("failed removal stops later removals without undoing prior revocation", async () => {
  const mock = gateway(
    { first: { members: [], nextCursor: null } },
    ["one", "two", "three"].map((personId) => ({
      personId,
      managedBy: "directory-bridge",
    })),
    (method, id) => method === "DELETE" && id === "two",
  );
  await assert.rejects(reconcile(config, mock.fetcher), /503/);
  assert.deepEqual([...mock.state.keys()], ["two", "three"]);
  assert.equal(writes(mock).length, 2);
});
