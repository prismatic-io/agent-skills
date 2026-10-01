import assert from "node:assert/strict";
import { flow, integration } from "@prismatic-io/spectral";
import { test } from "vitest";
import {
  UnsupportedInterface,
  verifyRegisteredMembership,
} from "./_verify-membership-reconcile.mjs";

const adapter = {
  flowStableKey: "sync",
  configVars: {
    directoryUrl: "$directoryUrl",
    directoryToken: "$directoryToken",
    accessUrl: "$accessUrl",
    accessToken: "$accessToken",
    group: "$group",
  },
};
const registered = (mutation = "none") =>
  integration({
    name: "Membership independent control",
    flows: [
      flow({
        name: "Sync",
        stableKey: "sync",
        onExecution: async (context) => {
          if (mutation === "unbridged-component") {
            try {
              (
                context as unknown as { _components: { invoke: () => unknown } }
              )._components.invoke();
            } catch {
              /* A subject catching a missing bridge must not create a failure verdict. */
            }
            return { data: {} };
          }
          const c = context.configVars as Record<string, string>;
          const group = encodeURIComponent(c.group);
          const request = async (
            service: "directory" | "access",
            path: string,
            method = "GET",
            body?: unknown,
          ) => {
            const result = await fetch(`${c[`${service}Url`]}${path}`, {
              method,
              headers: {
                authorization: `Bearer ${c[`${service}Token`]}`,
                "content-type": "application/json",
              },
              ...(body ? { body: JSON.stringify(body) } : {}),
            });
            if (!result.ok) throw new Error("request failed");
            return result.status === 204 ? undefined : result.json();
          };
          const desired = new Set<string>();
          let cursor: string | null = null;
          do {
            let page: {
              members: { id: string; enabled: unknown; kind: string }[];
              nextCursor: string | null;
            };
            try {
              page = await request(
                "directory",
                `/v1/groups/${group}/members${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
              );
            } catch (error) {
              if (mutation === "use-partial-snapshot") break;
              throw error;
            }
            for (const person of page.members) {
              if (
                (mutation === "truthy-enabled"
                  ? person.enabled
                  : person.enabled === true) &&
                person.kind === "employee"
              )
                desired.add(
                  mutation === "fold-identity"
                    ? person.id.toLowerCase()
                    : person.id,
                );
            }
            cursor = page.nextCursor;
          } while (cursor);
          const { grants } = await request(
            "access",
            `/v1/groups/${group}/grants`,
          );
          const existing = new Set(
            grants.map((grant: { personId: string }) => grant.personId),
          );
          const add = async () => {
            for (const id of desired) {
              if (existing.has(id) && mutation !== "retag-manual") continue;
              try {
                await request(
                  "access",
                  `/v1/groups/${group}/grants/${encodeURIComponent(id)}`,
                  "PUT",
                  { managedBy: "directory-bridge" },
                );
              } catch (error) {
                if (mutation !== "continue-after-failure") throw error;
              }
            }
          };
          const remove = async () => {
            for (const grant of grants) {
              if (
                !desired.has(grant.personId) &&
                (grant.managedBy === "directory-bridge" ||
                  mutation === "delete-manual")
              )
                await request(
                  "access",
                  `/v1/groups/${group}/grants/${encodeURIComponent(grant.personId)}`,
                  "DELETE",
                );
            }
          };
          if (mutation === "delete-before-add") {
            await remove();
            await add();
          } else {
            await add();
            await remove();
          }
          return { data: { arbitraryResult: true } };
        },
      }),
    ],
  });
test("independent registered flow matches frozen source's observable effects", async () => {
  const report = await verifyRegisteredMembership(registered(), adapter);
  assert.equal(report.passed, true, JSON.stringify(report.failures));
  assert.equal(report.scenarios, 5);
});
for (const mutant of [
  "use-partial-snapshot",
  "truthy-enabled",
  "fold-identity",
  "retag-manual",
  "continue-after-failure",
  "delete-manual",
  "delete-before-add",
])
  test(`membership checker rejects ${mutant}`, async () => {
    const report = await verifyRegisteredMembership(
      registered(mutant),
      adapter,
    );
    assert.equal(report.passed, false);
  });
test("unknown flow and missing configuration are unsupported, not migration failures", async () => {
  await assert.rejects(
    () => verifyRegisteredMembership(registered(), {}),
    UnsupportedInterface,
  );
  await assert.rejects(
    () =>
      verifyRegisteredMembership(registered(), {
        ...adapter,
        flowStableKey: "missing",
      }),
    UnsupportedInterface,
  );
});

test("swallowed managed-component bridge errors remain unsupported", async () => {
  await assert.rejects(
    () =>
      verifyRegisteredMembership(registered("unbridged-component"), adapter),
    UnsupportedInterface,
  );
});
