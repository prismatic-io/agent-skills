import { readFile, rename, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const main = async () => {
  const source = required("ORDER_FEED_URL");
  const destination = required("FULFILLMENT_URL");
  const sourceToken = required("ORDER_FEED_TOKEN");
  const destinationToken = required("FULFILLMENT_TOKEN");
  const statePath = required("CURSOR_FILE");
  let cursor;
  try {
    cursor = JSON.parse(await readFile(statePath, "utf8")).cursor;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    cursor = required("INITIAL_CURSOR");
  }

  const request = async (url, token, options = {}) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(30000),
      });
      if (response.ok) return response;
      if (![429, 503].includes(response.status) || attempt === 2)
        throw new Error(`HTTP ${response.status} for ${new URL(url).pathname}`);
      const retryAfter = response.headers.get("retry-after");
      const seconds = retryAfter === null ? 2 ** attempt : Number(retryAfter);
      await response.arrayBuffer();
      await sleep(
        Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 1000,
      );
    }
  };

  while (true) {
    const url = new URL("/changes", source);
    url.searchParams.set("after", cursor);
    const page = await (await request(url, sourceToken)).json();
    for (const order of page.orders) {
      if (order.status !== "paid") continue;
      const payload = {
        externalId: order.id,
        customerEmail: order.customer.email.trim().toLowerCase(),
        currency: order.currency,
        lines: order.items.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
          unitPriceCents: item.unit_price_cents,
        })),
      };
      await request(
        new URL(`/orders/${encodeURIComponent(order.id)}`, destination),
        destinationToken,
        { method: "PUT", body: JSON.stringify(payload) },
      );
    }
    if (typeof page.next_cursor !== "string" || page.next_cursor === cursor)
      throw new Error("Feed did not return an advancing cursor");
    await writeFile(
      `${statePath}.tmp`,
      JSON.stringify({ cursor: page.next_cursor }),
    );
    await rename(`${statePath}.tmp`, statePath);
    cursor = page.next_cursor;
    if (!page.has_more) break;
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
