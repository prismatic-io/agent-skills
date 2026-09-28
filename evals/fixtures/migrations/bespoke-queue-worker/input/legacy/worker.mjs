import { pathToFileURL } from "node:url";

export const drainOnce = async (
  { queueUrl, queueToken, crmUrl, crmToken },
  request = fetch,
) => {
  const response = await request(new URL("/messages?limit=10", queueUrl), {
    headers: { Authorization: `Bearer ${queueToken}` },
  });
  if (!response.ok) throw new Error(`Lease failed: ${response.status}`);
  const { messages } = await response.json();
  let acknowledged = 0;
  for (const message of messages) {
    const event = message.body;
    const delivered = await request(
      new URL(`/customers/${encodeURIComponent(event.customerId)}`, crmUrl),
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${crmToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": event.eventId,
        },
        body: JSON.stringify({ email: event.email, active: event.active }),
      },
    );
    if (!delivered.ok) throw new Error(`CRM failed: ${delivered.status}`);
    const ack = await request(
      new URL(`/messages/${encodeURIComponent(message.receipt)}`, queueUrl),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${queueToken}` },
      },
    );
    if (!ack.ok) throw new Error(`Acknowledgement failed: ${ack.status}`);
    acknowledged++;
  }
  return { acknowledged };
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const names = ["QUEUE_URL", "QUEUE_TOKEN", "CRM_URL", "CRM_TOKEN"];
  if (names.some((name) => !process.env[name]))
    throw new Error(`Required: ${names.join(", ")}`);
  drainOnce({
    queueUrl: process.env.QUEUE_URL,
    queueToken: process.env.QUEUE_TOKEN,
    crmUrl: process.env.CRM_URL,
    crmToken: process.env.CRM_TOKEN,
  })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
