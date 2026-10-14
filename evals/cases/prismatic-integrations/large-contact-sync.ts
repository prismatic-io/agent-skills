import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Our customers use Salesforce. Can you build an integration that copies their contacts into our app when they connect, then keeps bringing in new contacts? Some customers have millions of existing contacts.",
  ),
  persona:
    "You own the application's contact import experience. Customers connect their own Salesforce account and app credentials. Copy contact ID, name and email; Salesforce Contact is the source object. Start the historical import when the customer enables the integration, without manual kicks, and keep receiving new contacts afterward. The app accepts contact upserts keyed by Salesforce contact ID; a mock destination adapter with a clearly stated assumed HTTP contract is fine. Credentials are unavailable, so use mocks and leave a review copy without deploying customer instances.",
  assertions: [
    {
      id: "contact-sync-behavior",
      type: "rubric",
      criteria:
        "A buildable CNI exposes customer-owned Salesforce and app connections, automatically imports existing contacts when the customer connects, and supports newly created contacts afterward. It maps contact identity and useful contact fields to the destination with a credible duplicate policy. Honor business details actually supplied during interaction; otherwise accept reasonable disclosed mapping and destination-contract assumptions. Source retrieval is bounded for million-record datasets, follows the selected Salesforce API's continuation contract, and terminates when exhausted. Assess business behavior independently of which platform primitive was chosen; the separate LDS assertion assesses product-pattern selection. No live credentials or customer deployment is required.",
    },
    // Product-pattern selection is graded separately from business correctness.
    {
      id: "native-large-data-sync",
      type: "rubric",
      criteria:
        "The historical import is wired into Prismatic's platform-managed Large Data Sync capability: a registered flow uses batchFlowTrigger with a deploy-time producer returning items and paginationState, batchConfig controls execution batches, and onExecution consumes those batches. Credit documented equivalent LDS wiring that starts the backfill when the customer connects. A feature mention or custom paging loop alone does not establish this capability. Authoritative contract: https://prismatic.io/docs/integrations/common-patterns/large-data-sync/ and installed Spectral public types. Source and registered configuration can establish activation without a live deployment or full-backfill runner test. Do not infer exactly-once delivery or downstream retry guarantees solely from use of LDS.",
      guidance:
        "Judge the generated source and registered flow configuration; a feature mention, unused import or handoff claim alone is insufficient. Omitted file excerpts are evidence limits, not implementation defects; abstain if they prevent judging activation." +
        "\n\n" +
        "Score proportionally to demonstrated LDS wiring, with partial credit for implemented portions. This assertion deliberately measures product-pattern selection from a vague request. A sound custom implementation can earn business-behavior credit separately, but does not establish LDS activation. Assess pagination correctness, authored tests, handoff prose and publication in their separate assertions, without deducting those gaps again here. Do not require a particular file layout, client library, batch size or incremental delivery mechanism.",
      evidence: { view: "source" },
    },
  ],
});
