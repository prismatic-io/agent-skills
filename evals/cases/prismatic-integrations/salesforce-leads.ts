import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "My customers use Salesforce. I need an integration that syncs Salesforce\nleads to my app. In addition to syncing Leads as they're created, I'll need to sync existing leads\nto my app (there may be thousands or millions). Also, my customers may not store Leads in standard\nLeads record type, and may have custom fields associated with their Lead or custom record type.\nI'll need a field mapper that maps SFDC fields to my app.",
  ),
  assertions: [
    {
      id: "requested-integration",
      type: "rubric",
      criteria:
        "The artifacts are a Prismatic Code Native Integration with authenticated\nboundaries for Salesforce and the destination application; deploy-time selection or discovery of\nthe Salesforce object/record shape; a configurable field mapping used by the sync; and behavior\nfor both existing records and newly-created or newly-observed records. Do not require a particular\nauth mechanism, API client, trigger style, or mapping UI.",
    },
    {
      id: "bounded-recovery",
      type: "rubric",
      criteria:
        "The implementation can process thousands or millions of existing records without\nloading the full dataset into one execution: it uses pagination plus bounded work, batching,\nstreaming, checkpoints, or an equivalently credible mechanism. Incremental work has a cursor,\nwatermark, event, or other resumable boundary, and the implementation addresses duplicate or\nretry behavior. Credit runtime guarantees only when supported by code and the selected API or\ncomponent contract. Public generated-manifest documentation is valid contract evidence; prose\nwritten only in the generated project's documentation is not. Do not require custom cursor code\nwhen a selected component contract owns bounded checkpointing. Multiple sound architectures can\npass.",
    },
  ],
});
