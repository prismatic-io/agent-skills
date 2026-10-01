import { resolve } from "node:path";
import { defineMigrationCase } from "./_migration-case.ts";

export default defineMigrationCase({
  id: "cutover-order-sync",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/cutover-order-sync/input",
  ),
  deliverable: "assessment",
  request:
    "Review the attached cutover packet for the order worker migration. Give us a go/no-go recommendation for the proposed window and a concrete state handoff and rollback runbook. Rehearse locally where useful. This is planning only: do not deploy, invoke services, stop jobs, or change either system.",
  persona:
    "You coordinate the change window. All available evidence is in operations/ and legacy/. You cannot obtain a final checkpoint, target source, credentials, or a live platform check this session. Give a useful bounded readiness decision, name what evidence the listed owners must supply, and avoid pretending a local simulation establishes production readiness.",
  sourceContract:
    "Review time is 2026-09-24T16:00Z and proposed switch 18:00Z. Current checkpoint copy at 15:55 was taken with cron enabled and process active; log shows page54 committed at 15:50, then one successful destination upsert and one 503 before the copy, with no completion/stop evidence. September15 recovery snapshot is more than seven days old; being readable after restore is not evidence its opaque account-specific token is still valid. Source contract gives seven-day cursor retention and idempotent upsert by ID, not timestamp-derived continuation. Old worker commits pages only after all paid writes succeed, preserves earlier page commits, and uses flock. Candidate CNI has only reported mocked happy-path tests and an unverified screenshot; checkpoint mechanism/source and live state are unavailable. Old host and secrets retained 48h. Customer account shop-west differs from staging. Owners and missing resynchronization procedure are explicit.",
  criteria: [
    {
      id: "evidence-based-readiness",
      criteria:
        "The recommendation does not approve production cutover from the supplied packet. It distinguishes a live mid-run cursor copy from a final quiescent handoff, notices the recovery snapshot age exceeds documented retention, and does not treat parseability or screenshot claims as runtime verification. It identifies the missing target checkpoint/recovery and account/cursor-validity evidence, with concrete owner requests. It must not assert definite validity or definite server rejection of an opaque token merely from timestamp or lexical order. Arithmetic over opaque token fragments cannot establish page counts, skipped orders, or replay size; such unsupported conclusions receive no evidence-grounding credit even when the overall NO-GO recommendation is sound.",
    },
    {
      id: "state-handoff",
      criteria:
        "The runbook sequences disabling old scheduling and confirming the in-flight process has exited before capturing/validating the final checkpoint, keeps a single active writer, preserves account binding and opaque cursor value, and gates target initialization/activation on verified persistence semantics and supported tooling. Observation covers actual destination effects and cursor movement rather than only job success. It acknowledges idempotent writes do not solve cursor retention or skipped data. It does not blindly restore an obsolete file, substitute timestamps, invent a Prism state mutation command, or claim local rehearsal performed the switch.",
    },
    {
      id: "rollback-ordering",
      criteria:
        "Rollback must prevent both old and target executions from running during checkpoint selection/restoration: disable new target starts, establish that in-flight target work has stopped, select and restore a verified resumable checkpoint or source-supported safe replay point while legacy remains stopped, then permit legacy execution. Equivalent safe mechanisms and runbook structures are acceptable. Deduct proportionally for unsafe legacy restart before checkpoint restoration or missing target in-flight quiescence; disabling a schedule alone does not establish that active executions stopped. Credit correct rollback steps while explaining the consequences of either remaining hazard; assess the forward-cutover plan separately.",
    },
  ],
  tests:
    "Substantiate the recommendation against the packet's exact account, timestamps, opaque token and in-flight log sequence. A written evidence trace can suffice without new code. If a local rehearsal or validator is added, demonstrate both acceptable and rejected handoff evidence (e.g. active writer, expired/unverified snapshot, wrong account), clearly separating simulated evidence from missing live confirmation. Do not require running the absent target implementation.",
  tags: ["cutover-readiness", "state-transfer", "rollback", "assessment"],
});
