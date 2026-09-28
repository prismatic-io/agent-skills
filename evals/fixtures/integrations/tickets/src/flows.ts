import { flow, type Connection } from "@prismatic-io/spectral";

export interface Ticket {
  id: string;
  title: string;
  status: "open" | "resolved";
  queueId: string;
}

export const mirrorTicket = flow({
  name: "Mirror Ticket",
  stableKey: "mirror-ticket",
  description: "Mirror an incoming ticket webhook to the configured archive",
  onExecution: async (context, params) => {
    const ticket = params.onTrigger.results.body.data as Ticket;
    const connection = context.configVars["Ticket Archive"] as Connection;
    const response = await fetch(
      `${String(connection.fields.baseUrl).replace(/\/$/, "")}/tickets/${encodeURIComponent(ticket.id)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${connection.fields.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ externalId: ticket.id, title: ticket.title, status: ticket.status }),
      },
    );
    if (response.status !== 204) throw new Error(`Ticket archive returned ${response.status}`);
    return { data: { mirroredId: ticket.id } };
  },
});

export const health = flow({
  name: "Health",
  stableKey: "ticket-health",
  description: "Report local integration readiness",
  onExecution: async () => ({ data: { status: "ready" } }),
});

export default [mirrorTicket, health];
