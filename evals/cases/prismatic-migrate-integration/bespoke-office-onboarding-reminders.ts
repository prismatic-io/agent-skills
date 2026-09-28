import { resolve } from "node:path";
import { defineMigrationCase } from "../../migration-case.ts";
export default defineMigrationCase({
  id: "bespoke-office-onboarding-reminders",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/bespoke-office-onboarding-reminders/input",
  ),
  request:
    "Our People Operations team wants this onboarding reminder job moved off the old Linux scheduler into Prismatic. Keep each coordinator's reminder useful at their local morning time, with the right upcoming starters and no duplicate messages. The running Python job, office settings, and service notes are attached. Build and verify the replacement locally; leave production sending off and explain what our deployer needs to configure before retiring the old job.",
  persona:
    "You manage office onboarding. Use only the attached operations notes and office settings to answer questions. You can confirm existing notification policy but cannot approve new catch-up, holiday, recipient, or timing rules. Production tokens are available to the deployer, not in this session. HR owns office settings; the service team owns the two documented gateways. Do not invent extra API methods or Prismatic guarantees. Prefer a recommendation over questions about implementation libraries. Do not volunteer test cases or coach the implementation.",
  sourceContract:
    "The Python source runs every15m, evaluates each office independently at current local hour8 weekdays using its IANA timezone, and requests the next weekday's starters (Friday->Monday, not holiday-aware). It ignores cancelled or notifyManager=false records and sorts remaining IDs before constructing one exact plain-text office coordinator email. Empty eligible lists send nothing. Different office accounts must remain separate. Encoded office IDs and separate bearer tokens are used. Mail key is SHA256 of compact Python JSON [officeId,localDate], shared service account namespace; mail accepts identical-body replay7d, conflicting payload409. All requests are sequential; first failure stops later processing, earlier accepted effects remain. Repeated scheduled calls within the hour depend on durable service idempotency; no catch-up outside hour8. HR freezes date-specific packets during the notification hour. No live sending is authorized.",
  criteria: [
    {
      id: "office-calendar-and-content",
      criteria:
        "Registered replacement preserves the per-office local weekday/time window, next-weekday start date, eligibility, deterministic content and recipient isolation under supplied office settings. Timezone handling accounts for ordinary daylight-saving and non-whole-hour offsets without hard-coded UTC office hours. It does not silently introduce catch-up or holiday rules. Account-owned office settings remain configurable.",
    },
    {
      id: "delivery-identity-and-failure",
      criteria:
        "Documented gateway calls preserve credentials and office identity. Replays preserve the existing service-account message identity and body so overlap or ambiguous acceptance need not cause duplicate email. A failed request is not treated as delivery, later processing stops, and earlier accepted messages are not undone. Handoff explains remaining activation and operational dependencies without claiming local mocks established live delivery.",
    },
  ],
  tests:
    "Exercise generated behavior across representative local time boundaries, office calendar differences and more than one recipient office. Verify a repeated invocation and a service failure after earlier acceptance, checking actual outgoing requests/effects and stable idempotency. Establish confidence that excluded or empty records do not create emails and that content is source-derived; equivalent boundary or differential tests are accepted.",
  tags: ["bespoke", "timezones", "office-notifications", "aggregation"],
});
