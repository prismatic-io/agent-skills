import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/boomi-order-sync/input",
  prompt: suite.prompt(
    "We are retiring Boomi. Port the attached order integration and account for the other exported process. These are the files we have today. Get the locally testable parts working and tell us what else you need before we can replace the running integration.",
  ),
  persona:
    "You own the integration for the business. No additional Boomi component exports or live credentials are available this session. You want useful implementation progress and a clear account of remaining blockers.",
  assertions: [
    {
      type: "rubric",
      id: "document-transform",
      criteria:
        "A registered CNI flow preserves the supplied Groovy transformation for every document in one source execution: parse each JSON payload, prefix order number with ORD-, sum qty × unitPrice into total, map exact US country to NA and every other or missing shipTo to INTL, preserve document Properties and set document.dynamic.userdefined.region or explain its target representation. Preserve document cardinality across batching, iteration or fan-out. A detached tested helper is insufficient. The map comment associates the script with NormalizeOrder but does not establish the missing map's complete configuration.",
    },
    {
      type: "rubric",
      id: "source-boundaries",
      criteria:
        "Preserve the MAIN process's listener → NormalizeOrder map → ERP send → stop ordering. Its connection, operation and map components are absent; placeholders must not silently succeed as if delivery were complete. Account for allowSimultaneous=false and the separate OTEL SEND to an absent collector connection. Telemetry is not proven redundant: omitted or replaced behavior must be identified as unresolved or proposed, without inventing a collector contract or process linkage.",
    },
  ],
});
