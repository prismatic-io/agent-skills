import { component, trigger } from "@prismatic-io/spectral";
import { apiConnection, connectionInput, request } from "./api";

const contactChanged = trigger({
  display: { label: "Contact Changed", description: "Receive contact changes" },
  scheduleSupport: "invalid",
  synchronousResponseSupport: "invalid",
  inputs: { connection: connectionInput },
  perform: async (_context, payload) => ({ payload }),
  onInstanceDeploy: async (context, { connection }) => {
    const webhook = await request(connection, "/subscriptions", "POST", {
      endpoint: context.webhookUrls[context.flow.name],
      event: "contact.changed",
    });
    return { instanceState: { subscriptionId: webhook.id } };
  },
  onInstanceDelete: async (context, { connection }) => {
    const id = context.instanceState.subscriptionId;
    if (id)
      await request(
        connection,
        `/subscriptions/${encodeURIComponent(String(id))}`,
        "DELETE",
      );
  },
});
export default component({
  key: "eval-webhooks-baseline",
  public: false,
  display: {
    iconPath: "icon.png",
    label: "Partner Webhooks",
    description: "Contact change notifications",
  },
  connections: [apiConnection],
  triggers: { contactChanged },
});
