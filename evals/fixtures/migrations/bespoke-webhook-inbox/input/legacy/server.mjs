import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const acceptDelivery = async (
  raw,
  headers,
  { secret, inbox, now = Date.now() },
) => {
  const timestamp = headers["x-event-time"];
  const delivery = headers["x-delivery-id"];
  const signature = headers["x-event-signature"];
  if (
    typeof timestamp !== "string" ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    typeof delivery !== "string" ||
    delivery.length === 0 ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return { status: 401, body: "unauthorized" };
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${delivery}.`)
    .update(raw)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
    return { status: 401, body: "unauthorized" };
  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return { status: 400, body: "invalid JSON" };
  }
  if (typeof event?.type !== "string" || typeof event?.id !== "string")
    return { status: 400, body: "missing event type or id" };
  await mkdir(inbox, { recursive: true });
  const key = createHash("sha256").update(delivery).digest("hex");
  try {
    await writeFile(
      join(inbox, `${key}.json`),
      JSON.stringify({ delivery, event }),
      { flag: "wx" },
    );
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  return { status: 202, body: "accepted" };
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!process.env.WEBHOOK_SECRET || !process.env.INBOX_DIR)
    throw new Error("WEBHOOK_SECRET and INBOX_DIR required");
  createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/events") {
      response.writeHead(404).end();
      return;
    }
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 1048576) {
          response.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const result = await acceptDelivery(
        Buffer.concat(chunks),
        request.headers,
        {
          secret: process.env.WEBHOOK_SECRET,
          inbox: process.env.INBOX_DIR,
        },
      );
      response
        .writeHead(result.status, { "Content-Type": "text/plain" })
        .end(result.body);
    } catch {
      response.writeHead(503).end("retry later");
    }
  }).listen(Number(process.env.PORT ?? 8080));
}
