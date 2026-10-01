import { resolve } from "node:path";
import { defineIntegrationCase } from "./_integration-case.ts";

export default defineIntegrationCase({
  id: "resolved-ticket-archive",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/integrations/cedar-contract",
  ),
  request:
    "Our customers use Cedar Desk for support. Build a Code Native Integration that keeps newly resolved tickets from their chosen support queues in our audit archive. Ask each customer for Cedar Desk and archive credentials, which queues to watch, and how often to check. Start with resolutions after that customer enables a queue; do not import older ones. Send each resolved ticket's ID, queue, title, and resolution time. If the archive is unavailable, a later run must recover without creating duplicate archive records. API.md describes both services. There are no live credentials or services; use local mocks only.",
  persona:
    "You manage this customer-facing archive integration. Customers may choose more than one queue. A newly selected queue starts from its current position, without importing old resolutions. An unrelated ticket update must not create an archive record. Archive writes must be confirmed before progress skips them; replay through the documented upsert is acceptable. Choose the technical mechanism from API.md and supported CNI capabilities. You have no preference for a polling trigger, scheduled flow, client, component, or state layout.",
  criteria: [
    {
      id: "resolved-ticket-routing",
      criteria:
        "A locally buildable CNI exposes customer-owned Cedar Desk and archive credentials, selected queues, and a check cadence. It establishes a silent initial position for each newly selected queue, consumes the documented change feed, archives only resolved tickets from selected queues, and sends the documented fields and opaque ticket identity through authenticated requests. Updates and pre-existing resolutions do not create archive records. Equivalent supported polling, scheduling, client, or component approaches are valid; do not require a particular helper, state API, endpoint wrapper in generated code, or file layout.",
    },
    {
      id: "continuation-and-recovery",
      criteria:
        "The chosen approach follows the source's opaque cursor and page contract, keeps progress for each selected queue, and does not skip an unconfirmed archive write after a downstream failure. Replaying a confirmed earlier write through the documented archive upsert is valid; exactly-once transport or an immediate retry loop is not required. An expired source cursor can only restart at the new baseline and that loss of history must not be described as recovered. Credit documented platform-owned guarantees when supported by registered configuration and the public contract. Do not require one state key, page count, batch size, or trigger architecture.",
    },
  ],
  validation:
    "representative local checks of silent first run, a resolved ticket routed from a selected queue, an unrelated update ignored, and a later page or fresh run after archive failure; inspect the actual registered flow and relevant request construction, with contract-shaped responses rather than a fixed test count or framework",
  tags: ["transfer", "cni", "change-feed", "customer-config", "recovery"],
});
