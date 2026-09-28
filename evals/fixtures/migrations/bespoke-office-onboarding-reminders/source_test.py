import importlib.util
import json
from pathlib import Path
import unittest
from datetime import datetime

spec = importlib.util.spec_from_file_location("reminders", Path(__file__).parent / "input/legacy/reminders.py")
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)


def office(identity="office/east", zone="America/New_York"):
    return {"id": identity, "name": identity, "timezone": zone, "coordinatorEmail": identity.replace("/", "-") + "@example.test"}


class Gateway:
    def __init__(self):
        self.calls = []
        self.accepted = {}
        self.fail_recipient = None
        self.lose_response_once = False
        self.people = [
            {"id": "b", "name": "Bo", "team": "Support", "cancelled": False, "notifyManager": True},
            {"id": "z", "name": "Cancelled", "team": "Ops", "cancelled": True, "notifyManager": True},
            {"id": "a", "name": "Ána", "team": "", "cancelled": False, "notifyManager": True},
            {"id": "c", "name": "Private", "team": "Ops", "cancelled": False, "notifyManager": False},
        ]

    def __call__(self, method, base, path, token, body=None, key=None):
        self.calls.append((method, base, path, token, body, key))
        if method == "GET":
            if token != "planning-test":
                raise RuntimeError("bad planning token")
            # API contract permits a different record order on each read.
            self.people.reverse()
            return {"people": self.people.copy()}
        if token != "mail-test":
            raise RuntimeError("bad mail token")
        if body["to"] == self.fail_recipient:
            raise RuntimeError("503")
        if key in self.accepted and self.accepted[key] != body:
            raise RuntimeError("409")
        self.accepted[key] = body.copy()
        if self.lose_response_once:
            self.lose_response_once = False
            raise TimeoutError("accepted but response lost")
        return None


def run(gateway, instant, offices=None):
    return source.send_reminders(offices or [office()], datetime.fromisoformat(instant),
                                 "https://planning.invalid", "planning-test", "https://mail.invalid", "mail-test", gateway)


class SourceContract(unittest.TestCase):
    def test_dst_changes_utc_hour_without_changing_local_policy(self):
        for instant in ["2026-03-06T13:15:00+00:00", "2026-03-09T12:15:00+00:00"]:
            with self.subTest(instant=instant):
                gateway = Gateway()
                self.assertEqual(run(gateway, instant), ["office/east"])
        for instant in ["2026-03-06T12:45:00+00:00", "2026-03-09T13:00:00+00:00", "2026-03-08T12:15:00+00:00"]:
            with self.subTest(instant=instant):
                gateway = Gateway()
                self.assertEqual(run(gateway, instant), [])
                self.assertEqual(gateway.calls, [])

    def test_fractional_timezone_and_friday_to_monday(self):
        gateway = Gateway()
        run(gateway, "2026-10-23T02:30:00+00:00", [office("office/nepal", "Asia/Kathmandu")])
        self.assertEqual(gateway.calls[0][2], "/v2/offices/office%2Fnepal/onboarding?start=2026-10-26")
        self.assertEqual(next(iter(gateway.accepted.values()))["text"], "Ána | \nBo | Support")

    def test_local_day_crosses_utc_day_and_offices_remain_separate(self):
        gateway = Gateway()
        offices = [office("island", "Pacific/Kiritimati"), office("other", "Pacific/Kiritimati"), office("west", "America/Anchorage")]
        self.assertEqual(run(gateway, "2026-01-11T18:00:00+00:00", offices), ["island", "other"])
        self.assertEqual(len(gateway.accepted), 2)
        self.assertTrue(all(call[2].endswith("start=2026-01-13") for call in gateway.calls if call[0] == "GET"))
        self.assertEqual({body["to"] for body in gateway.accepted.values()}, {"island@example.test", "other@example.test"})

    def test_ambiguous_acceptance_and_reordered_input_replay_send_once(self):
        gateway = Gateway()
        gateway.lose_response_once = True
        with self.assertRaises(TimeoutError):
            run(gateway, "2026-03-09T12:00:00+00:00")
        self.assertEqual(len(gateway.accepted), 1)
        run(gateway, "2026-03-09T12:15:00+00:00")
        self.assertEqual(len(gateway.accepted), 1)
        sends = [call for call in gateway.calls if call[0] == "POST"]
        self.assertEqual(sends[0][4:], sends[1][4:])

    def test_second_office_failure_preserves_first_and_stops_third(self):
        gateway = Gateway()
        offices = [office("one"), office("two"), office("three")]
        gateway.fail_recipient = "two@example.test"
        with self.assertRaisesRegex(RuntimeError, "503"):
            run(gateway, "2026-03-09T12:00:00+00:00", offices)
        self.assertEqual(len(gateway.accepted), 1)
        self.assertEqual([c[4]["to"] for c in gateway.calls if c[0] == "POST"], ["one@example.test", "two@example.test"])
        gateway.fail_recipient = None
        run(gateway, "2026-03-09T12:15:00+00:00", offices)
        self.assertEqual(len(gateway.accepted), 3)

    def test_empty_eligible_list_sends_nothing_and_no_outside_window_catchup(self):
        gateway = Gateway()
        gateway.people = [p for p in gateway.people if p["cancelled"] or not p["notifyManager"]]
        self.assertEqual(run(gateway, "2026-03-09T12:45:00+00:00"), [])
        self.assertFalse(gateway.accepted)
        gateway.calls.clear()
        self.assertEqual(run(gateway, "2026-03-09T13:00:00+00:00"), [])
        self.assertEqual(gateway.calls, [])


if __name__ == "__main__":
    unittest.main()
