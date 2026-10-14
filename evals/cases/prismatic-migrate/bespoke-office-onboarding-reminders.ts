import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures:
    "../../fixtures/migrations/bespoke-office-onboarding-reminders/input",
  prompt: suite.prompt(
    "Our People Operations team wants this onboarding reminder job moved off the old Linux scheduler into Prismatic. Keep each coordinator's reminder useful at their local morning time, with the right upcoming starters and no duplicate messages. The running Python job, office settings, and service notes are attached. Build and verify the replacement locally; leave production sending off and explain what our deployer needs to configure before retiring the old job.",
  ),
  persona:
    "You manage office onboarding. Use only the attached operations notes and office settings to answer questions. You can confirm existing notification policy but cannot approve new catch-up, holiday, recipient, or timing rules. Production tokens are available to the deployer, not in this session. HR owns office settings; the service team owns the two documented gateways.",
  assertions: [
    {
      type: "rubric",
      id: "office-calendar-and-content",
      criteria:
        "Registered replacement preserves the per-office local weekday/time window, next-weekday start date, eligibility, deterministic content and recipient isolation under supplied office settings. Timezone handling accounts for ordinary daylight-saving and non-whole-hour offsets without hard-coded UTC office hours. It does not silently introduce catch-up or holiday rules. Account-owned office settings remain configurable. The source runs every fifteen minutes, considers each office at local hour 8 on weekdays using its IANA zone, and requests next-weekday starters (Friday to Monday). Exclude cancelled and notifyManager=false records, sort remaining IDs, and send one exact plain-text coordinator email only for a nonempty eligible list. HR freezes date-specific packets during that hour.",
    },
    {
      type: "rubric",
      id: "delivery-identity-and-failure",
      criteria:
        "Documented gateway calls preserve credentials and office identity. Replays preserve the existing service-account message identity and body so overlap or ambiguous acceptance need not cause duplicate email. A failed request is not treated as delivery, later processing stops, and earlier accepted messages are not undone. Handoff explains remaining activation and operational dependencies without claiming local mocks established live delivery. Encode office IDs and use separate bearer tokens. Mail identity is SHA256 of compact Python JSON [officeId,localDate] in the shared service-account namespace. Identical-body replay is accepted for seven days; conflicting payload is 409. Requests are sequential.",
    },
  ],
});
