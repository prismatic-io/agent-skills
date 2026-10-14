import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Our existing Order Relay loses deliveries when the destination briefly fails. Make transient failures recover automatically, with at most three delivery attempts per order and a delay between retries. Retry rate limiting, server failures, and uncertain network failures; stop on invalid-request or authentication failures. Avoid duplicate destination orders if a request succeeded but its response was lost. Keep successful deliveries and the existing Health flow working as before. API.md describes the destination's idempotency support. Use mocked calls only.",
  ),
  persona:
    "You operate Order Relay. Three means three total delivery attempts including the first; a short delay is acceptable and need not be customer configurable. Retry HTTP 429, 5xx and network errors; stop on invalid-request and authentication failures. Other genuinely transient responses, such as request timeouts, may also be retried within the same bound. An exhausted order must remain visibly failed. The destination honors Idempotency-Key using the source order ID, even when the first successful response is lost. Preserve the existing webhook schema, connection and stable flow/config identities. You do not care whether supported platform retry or local request retry is used, provided its documented semantics meet these outcomes.",
  fixtures: "../../fixtures/integrations/orders",
  assertions: [
    {
      id: "bounded-recovery",
      type: "rubric",
      criteria:
        "Actual registered delivery recovers from transient 429/5xx/network failures with a delay and at most three total destination attempts for an order, does not retry invalid-request or authentication failures, and exposes exhaustion as failure. Every attempt uses the same source-order Idempotency-Key and equivalent body, so the documented destination deduplicates a successful-but-unacknowledged request. Successful first attempts remain single deliveries. Credit platform-owned guarantees only when supported by registered configuration and the public SDK contract; local retries are equally valid. Do not require a specific retry field, function name or timing mechanism.",
    },
    {
      id: "backward-compatibility",
      type: "rubric",
      criteria:
        "Preserve Relay Order stableKey relay-order and its original id/customer.email/total mapping, Health stableKey order-health and ready result without external calls, Order Destination stableKey order-destination with existing baseUrl/token fields, and unrelated behavior. Do not disclose credentials in logs, error messages or outputs.",
    },
  ],
});
