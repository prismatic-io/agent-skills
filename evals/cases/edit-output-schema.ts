import { resolve } from "node:path";
import { defineComponentCase } from "../component-case.ts";

export default defineComponentCase({
  id: "edit-output-schema",
  service: "Partner Records",
  mode: "edit",
  fixture: resolve(import.meta.dirname, "../fixtures/components/records"),
  request:
    "Our existing Partner Records connector is in this directory, with its API contract in API.md. Get Contact works, but builders cannot see its output fields until they execute it. Make the fields available beforehand in the low-code designer, including its address, tags, and optional email. Keep the output and existing integrations working as they do now.",
  persona:
    "You use the low-code designer and want to map contact fields before running the integration. You do not write code and have no live partner credentials. Publish a sandbox copy for review. Existing integrations and baseline tests must keep working.",
  operations: ["Get Contact with output fields discoverable before execution"],
  apiFailure: false,
  preserved: [
    "all existing connection/action keys, input keys, runtime outputs, branch routing, and API failure behavior",
  ],
  criteria: [
    {
      id: "contact-output-schema",
      criteria:
        "Get Contact declares a valid Spectral action output schema for its data payload, not the surrounding {data} result. It describes nested address fields, string-array tags, boolean active, and optional email accurately against API.md. The schema is present in the compiled component's metadata, not merely a comment, example result, or unused constant. Runtime responses remain unmodified, including absent email.",
    },
  ],
  tests: [],
  tags: ["edit", "output-schema", "metadata"],
});
