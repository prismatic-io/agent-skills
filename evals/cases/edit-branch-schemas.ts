import { resolve } from "node:path";
import { defineComponentCase } from "../component-case.ts";

export default defineComponentCase({
  id: "edit-branch-schemas",
  service: "Partner Records",
  mode: "edit",
  fixture: resolve(import.meta.dirname, "../fixtures/components/records"),
  request:
    "The existing Partner Records connector has a Review Contact action that takes Approved or Rejected branches. Builders need to see the appropriate fields on each branch before running it: approval time for Approved, and reason plus whether it can be retried for Rejected. Add that capability without changing routing or the returned data. API.md describes the service.",
  persona:
    "You build low-code integrations with both review branches. You need fields available for mapping before execution and have no preference about code organization. No live partner account is available; publish a sandbox copy for review.",
  operations: [
    "Review Contact with distinct discoverable fields for Approved and Rejected",
  ],
  apiFailure: false,
  preserved: [
    "all existing action/connection/input keys, exact Approved and Rejected branch names, payload shapes, and routing",
  ],
  criteria: [
    {
      id: "branch-output-schemas",
      criteria:
        "The registered static-branch Review Contact action has valid Spectral branching output metadata with schemas keyed exactly Approved and Rejected. Each schema describes that branch's data, not a {branch,data} wrapper. Approved exposes contactId and approvedAt; Rejected exposes contactId, reason, and boolean retryable. Schemas survive the build. Existing branch selection is unchanged; a single union schema or dynamic branch rewrite is insufficient. These schemas describe discoverable fields; required arrays and runtime rejection of the opposite branch's payload are not required.",
    },
  ],
  tests: [],
  tags: ["edit", "output-schema", "branching"],
});
