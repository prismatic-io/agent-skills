import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/bespoke-membership-reconcile/input",
  prompt: suite.prompt(
    "Move this directory-to-training-portal bridge from its old host into Prismatic. The source and service team's operating notes are attached. Keep access decisions the same, including helpdesk exceptions; an upstream outage must not lock everyone out. Build and test the replacement locally and give operations a clear handoff for retiring the scheduled job.",
  ),
  persona:
    "You own training portal operations, not its implementation. Answer questions using legacy/OPERATIONS.md and the supplied script. The gateways are maintained by another team and their documented endpoints are the available interface. You can supply both tokens and the group ID at deployment, not here. The existing fifteen-minute cadence and singleton scheduling must remain. You cannot approve changes to access policy or invent a new transactional endpoint. Ask for a recommended operational setup if target scheduling details need decisions. You do not know Prismatic internals.",
  assertions: [
    {
      type: "rubric",
      id: "membership-and-ownership",
      criteria:
        "Generated registered flow preserves eligibility, exact identity, deduplication and ownership semantics. It neither revokes nor takes ownership of helpdesk grants, including an existing desired employee's manual grant. Correctly handles a complete empty snapshot and opaque identifiers using the documented gateway contracts. Only enabled===true records contribute case-sensitive IDs. Add missing identities with managedBy=directory-bridge; a complete empty snapshot removes bridge-owned grants only. Encode group/person segments and cursors and keep gateway credentials separate.",
    },
    {
      type: "rubric",
      id: "snapshot-and-partial-effects",
      criteria:
        "No incomplete or failed directory snapshot is treated as authoritative membership for access writes. Missing grants are added before stale bridge grants are removed. Failures stop further writes while retaining externally committed successes, and a subsequent run can reconcile from those successes. Cadence and nonoverlap assumptions are implemented or made explicit activation prerequisites without inventing unsupported transactions or changing access policy. Read every directory page before mutation, then read all current grants once. PUT/DELETE are idempotent. Preserve the fifteen-minute singleton cadence; source has no transaction or configured application retry.",
    },
  ],
});
