import { defineIntegrationCase } from "./_integration-case.ts";

export default defineIntegrationCase({
  id: "asana-slack",
  request:
    "I maintain Asana. I need to build an integration for my customers so when\nthey create a task in a project, a notification is sent to Slack that the task was created.\nBuild an integration that prompts a user who deploys the integration for their Slack and Asana\ncredentials, which Asana project(s) they want to watch, and which Slack channel to send the\nnotifications to.",
  persona:
    "You are the product developer requesting the integration. You can clarify the\nAsana-to-Slack behavior but have no preferences about APIs, authentication protocols, code\nstructure, or libraries. Asana and Slack credentials are not available in this session;\ncustomer deployment and live service verification are outside this request.",
  criteria: [
    {
      id: "requested-integration",
      criteria:
        "The artifacts are a Prismatic Code Native Integration that connects to both\nAsana and Slack without embedded credentials; exposes deploy-time configuration for Asana\ncredentials, Slack credentials, one or more watched Asana projects, and a Slack destination\nchannel; represents newly-created Asana tasks as the source event through a reasonable trigger\nor polling design; and sends a useful task-created notification to the configured Slack channel.\nDo not require one particular auth mechanism, component manifest, trigger style, or file layout.",
    },
  ],
  validation:
    "New task routing to the configured channel; unrelated events or pre-existing tasks; representative service failure and repeat delivery behavior.",
});
