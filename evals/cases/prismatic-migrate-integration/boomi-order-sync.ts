import { resolve } from "node:path";
import { defineMigrationCase } from "../../migration-case.ts";

export default defineMigrationCase({
  id: "boomi-order-sync",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/boomi-order-sync/input",
  ),
  request:
    "We are retiring Boomi. Port the attached order integration and account for the other exported process. These are the files we have today. Get the locally testable parts working and tell us what else you need before we can replace the running integration.",
  persona:
    "You own the integration for the business. No additional Boomi component exports or live credentials are available this session. Do not invent missing configuration. You want useful implementation progress and a clear account of remaining blockers; you have no preferences about implementation architecture.",
  sourceContract:
    "MAIN process XML edges specify listener -> NormalizeOrder map -> ERP send -> stop. Referenced connection, operation and map components are absent. The comment associates the map with the supplied Groovy script but is not a complete map export. The script loops across dataContext documents, parses each JSON payload, builds id ORD- plus order number, sums qty times unitPrice into total, maps exact US country to NA and every other/missing shipTo to INTL, preserves document Properties and sets document.dynamic.userdefined.region. Separate OTEL process performs a SEND to an absent collector connection; it is not proven redundant. allowSimultaneous=false is present in process metadata.",
  criteria: [
    {
      id: "document-transform",
      criteria:
        "The generated transformation is reachable from a registered Prismatic CNI flow, not merely a detached helper tested in isolation. Executable target code preserves the supported Groovy transformation for every document supplied by one source execution, with corresponding output/effects for each and no silent loss. Target batching, iteration, or fan-out may vary; do not require a particular request envelope. This includes including order ID, arithmetic total and region semantics. Meaningful source properties are preserved or their target representation and limitations are explained. Do not demand a specific Prismatic data structure for Boomi Properties. The map's unavailable configuration must not be silently represented as known.",
    },
    {
      id: "source-boundaries",
      criteria:
        "The artifact reflects the order of source effects and identifies absent map, connection and operation details that prevent verified end-to-end ERP delivery. Placeholder endpoints or mappings cannot silently succeed as if migration were complete. Source concurrency assumptions and the separately exported telemetry SEND are accounted for, with any omission or replacement explicitly identified as unresolved or a proposed change. Do not require invention of a telemetry collector contract or absent process linkage.",
    },
  ],
  tests:
    "Local verification demonstrates preservation of document cardinality across one source execution containing multiple documents, through the implemented target batching, iteration, or fan-out path. Separate unrelated single-document test invocations alone do not establish this property. It also exercises multiple line items, a US address, a non-US address, and missing shipTo. It checks values rather than only result shape. Unsupported destination configuration is demonstrated or clearly isolated from claims of verified delivery.",
  tags: ["boomi", "partial-export"],
});
