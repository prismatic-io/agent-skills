import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const sourceTests = fileURLToPath(
  new URL(
    "../../fixtures/migrations/bespoke-office-onboarding-reminders/source_test.py",
    import.meta.url,
  ),
);
const scenarios = [
  "test_dst_changes_utc_hour_without_changing_local_policy",
  "test_fractional_timezone_and_friday_to_monday",
  "test_local_day_crosses_utc_day_and_offices_remain_separate",
  "test_ambiguous_acceptance_and_reordered_input_replay_send_once",
  "test_second_office_failure_preserves_first_and_stops_third",
  "test_empty_eligible_list_sends_nothing_and_no_outside_window_catchup",
];
for (const scenario of scenarios)
  test(`office reminder source: ${scenario}`, () => {
    const result = spawnSync(
      "python3",
      [sourceTests, `SourceContract.${scenario}`, "-v"],
      {
        encoding: "utf8",
        timeout: 10_000,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stderr, /Ran 1 test/);
  });
