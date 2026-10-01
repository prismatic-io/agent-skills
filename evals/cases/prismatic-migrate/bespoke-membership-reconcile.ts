import { resolve } from "node:path";
import { defineMigrationCase } from "./_migration-case.ts";

export default defineMigrationCase({
  id: "bespoke-membership-reconcile",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/bespoke-membership-reconcile/input",
  ),
  request:
    "Move this directory-to-training-portal bridge from its old host into Prismatic. The source and service team's operating notes are attached. Keep access decisions the same, including helpdesk exceptions; an upstream outage must not lock everyone out. Build and test the replacement locally and give operations a clear handoff for retiring the scheduled job.",
  persona:
    "You own training portal operations, not its implementation. Answer questions using legacy/OPERATIONS.md and the supplied script. The gateways are maintained by another team and their documented endpoints are the available interface. You can supply both tokens and the group ID at deployment, not here. The existing fifteen-minute cadence and singleton scheduling must remain. You cannot approve changes to access policy or invent a new transactional endpoint. Ask for a recommended operational setup if target scheduling details need decisions. Do not volunteer test inventories or pretend to know Prismatic internals.",
  sourceContract:
    "The source collects a complete snapshot across opaque cursor pages before any access mutation; only enabled===true employee records contribute exact case-sensitive IDs, deduplicated. It reads all current grants once. All desired identities already present, including helpdesk-owned ones, are left untouched. It adds missing desired identities with managedBy=directory-bridge before deleting stale directory-bridge grants; helpdesk exceptions are never removed or retagged. Empty complete desired snapshot removes bridge-owned grants only. Encodes group/person segments and cursors and keeps gateway credentials separate. First failed read or mutation throws and stops processing; earlier successful mutations remain externally committed. PUT/DELETE are idempotent so later reconciliation converges from partial progress. Current job cadence15m singleton; no transaction or configured application retry exists.",
  criteria: [
    {
      id: "membership-and-ownership",
      criteria:
        "Generated registered flow preserves eligibility, exact identity, deduplication and ownership semantics. It neither revokes nor takes ownership of helpdesk grants, including an existing desired employee's manual grant. Correctly handles a complete empty snapshot and opaque identifiers using the documented gateway contracts.",
    },
    {
      id: "snapshot-and-partial-effects",
      criteria:
        "No incomplete or failed directory snapshot is treated as authoritative membership for access writes. Missing grants are added before stale bridge grants are removed. Failures stop further writes while retaining externally committed successes, and a subsequent run can reconcile from those successes. Cadence and nonoverlap assumptions are implemented or made explicit activation prerequisites without inventing unsupported transactions or changing access policy.",
    },
  ],
  tests:
    "Exercise the generated flow against representative paginated directory data and a mixed bridge/helpdesk grant list. Demonstrate that incomplete snapshot reads cannot cause access writes, and that partial mutation failure followed by another run converges without deleting manual exceptions or compensating prior successful grants. Verify meaningful boundary cases in eligibility, identity and complete empty snapshots; equivalent tests or property-based verification count.",
  tags: ["bespoke", "reconciliation", "access-ownership", "snapshot"],
});
