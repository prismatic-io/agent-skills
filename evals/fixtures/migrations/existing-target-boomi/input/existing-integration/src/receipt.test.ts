import { describe, expect, it } from "vitest";
import { receiptFlow } from "./receipt";

const execute = (body: unknown, prefix = "RCPT") =>
  receiptFlow.onExecution(
    { configVars: { "Receipt Prefix": prefix } } as never,
    { onTrigger: { results: { body: { data: body } } } } as never,
  );

describe("warehouse callback contract", () => {
  it("keeps caller identifiers verbatim and uses instance configuration", async () => {
    await expect(
      execute({ eventId: "receipt/009", warehouse: "phx-west" }, "RECEIVED"),
    ).resolves.toEqual({
      data: {
        eventId: "receipt/009",
        reference: "RECEIVED:phx-west:receipt/009",
        status: "accepted",
      },
    });
  });

  it("rejects a missing event identifier", async () => {
    await expect(execute({ warehouse: "phx-west" })).rejects.toThrow(
      "eventId must be a nonempty string",
    );
  });

  it("rejects a missing warehouse", async () => {
    await expect(execute({ eventId: "receipt/010" })).rejects.toThrow(
      "warehouse must be a nonempty string",
    );
  });
});
