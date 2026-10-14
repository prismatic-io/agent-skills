import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/cutover-order-sync/input",
  prompt: suite.prompt(
    "Review the attached cutover packet for the order worker migration. Give us a go/no-go recommendation for the proposed window and a concrete state handoff and rollback runbook. Rehearse locally where useful. This is planning only: do not deploy, invoke services, stop jobs, or change either system.",
    "assessment",
  ),
  persona:
    "You coordinate the change window. All available evidence is in operations/ and legacy/. You cannot obtain a final checkpoint, target source, credentials, or a live platform check this session. Give a useful bounded readiness decision, name what evidence the listed owners must supply, and avoid pretending a local simulation establishes production readiness.",
  omitAssertions: ["local-checks"],
  assertions: [
    {
      type: "rubric",
      id: "evidence-based-readiness",
      criteria:
        "The recommendation does not approve production cutover from the supplied packet. It distinguishes a live mid-run cursor copy from a final quiescent handoff, notices the recovery snapshot age exceeds documented retention, and does not treat parseability or screenshot claims as runtime verification. It identifies the missing target checkpoint/recovery and account/cursor-validity evidence, with concrete owner requests. It must not assert definite validity or definite server rejection of an opaque token merely from timestamp or lexical order. Arithmetic over opaque token fragments cannot establish page counts, skipped orders, or replay size; such unsupported conclusions receive no evidence-grounding credit even when the overall NO-GO recommendation is sound. Review time is 2026-09-24T16:00Z and proposed switch 18:00Z. The 15:55 copy was taken with cron enabled and process active: page54 committed at 15:50, then one upsert and one 503 with no completion/stop evidence. The September15 snapshot exceeds seven-day retention. Customer account shop-west differs from staging.",
    },
    {
      type: "rubric",
      id: "state-handoff",
      criteria:
        "The runbook sequences disabling old scheduling and confirming the in-flight process has exited before capturing/validating the final checkpoint, keeps a single active writer, preserves account binding and opaque cursor value, and gates target initialization/activation on verified persistence semantics and supported tooling. Observation covers actual destination effects and cursor movement rather than only job success. It acknowledges idempotent writes do not solve cursor retention or skipped data. It does not blindly restore an obsolete file, substitute timestamps, invent a Prism state mutation command, or claim local rehearsal performed the switch. Source commits only after all paid writes in a page succeed, retains earlier page commits and uses flock. Target has reported mocked happy-path tests and an unverified screenshot only; source/checkpoint mechanism and live state are unavailable.",
    },
    {
      type: "rubric",
      id: "rollback-ordering",
      criteria:
        "Rollback must prevent both old and target executions from running during checkpoint selection/restoration: disable new target starts, establish that in-flight target work has stopped, select and restore a verified resumable checkpoint or source-supported safe replay point while legacy remains stopped, then permit legacy execution. Equivalent safe mechanisms and runbook structures are acceptable. Deduct proportionally for unsafe legacy restart before checkpoint restoration or missing target in-flight quiescence; disabling a schedule alone does not establish that active executions stopped. Credit correct rollback steps while explaining the consequences of either remaining hazard; assess the forward-cutover plan separately. Old host and secrets are retained 48 hours; owners and the missing resynchronization procedure are listed in the packet.",
    },
    suite.assessmentScope,
  ],
});
