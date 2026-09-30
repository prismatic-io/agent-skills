import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.ts";

let baseUrl = "";
let close = () => {};

beforeAll(async () => {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});

afterAll(() => close());

const signIn = async (email: string, password: string) => {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(response.status).toBe(204);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
};

describe("api", () => {
  it("rejects requests without a session", async () => {
    const response = await fetch(`${baseUrl}/api/me`);
    expect(response.status).toBe(401);
  });

  it("returns the signed-in user and tenant", async () => {
    const cookie = await signIn("ada@acme.test", "demo-ada");
    const response = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
    expect(await response.json()).toEqual({
      user: {
        id: "user-ada",
        email: "ada@acme.test",
        name: "Ada Lovelace",
        role: "admin",
      },
      tenant: { id: "tenant-acme", name: "Acme Co" },
    });
  });

  it("scopes projects to the signed-in tenant", async () => {
    const cookie = await signIn("grace@globex.test", "demo-grace");
    const response = await fetch(`${baseUrl}/api/projects`, {
      headers: { cookie },
    });
    expect(await response.json()).toEqual([
      { id: "project-2", tenantId: "tenant-globex", name: "Warehouse audit" },
    ]);
  });
});
