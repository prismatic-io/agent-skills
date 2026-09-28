"""Office onboarding reminders. Run with Python 3.11+ and system timezone data."""
import argparse
import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


def send_reminders(offices, now, planning_url, planning_token, mail_url, mail_token, call=None):
    if now.tzinfo is None:
        raise ValueError("now must identify an instant")

    def http(method, base, path, token, body=None, key=None):
        headers = {"Authorization": "Bearer " + token}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        if key is not None:
            headers["Idempotency-Key"] = key
        with urlopen(Request(base.rstrip("/") + path, data=data, headers=headers, method=method), timeout=30) as response:
            raw = response.read()
        return json.loads(raw) if raw else None

    request = call or http
    sent = []
    for office in offices:
        local = now.astimezone(ZoneInfo(office["timezone"]))
        if local.hour != 8 or local.weekday() >= 5:
            continue
        # A Friday reminder covers Monday, not Saturday.
        start_day = local.date() + timedelta(days=3 if local.weekday() == 4 else 1)
        packet = request("GET", planning_url,
                         "/v2/offices/" + quote(office["id"], safe="") + "/onboarding?start=" + start_day.isoformat(),
                         planning_token)
        people = sorted((p for p in packet["people"] if not p["cancelled"] and p["notifyManager"]), key=lambda p: p["id"])
        if not people:
            continue
        body = {
            "to": office["coordinatorEmail"],
            "subject": "New starters for " + office["name"] + " on " + start_day.isoformat(),
            "text": "\n".join(p["name"] + " | " + p["team"] for p in people),
        }
        key_material = json.dumps([office["id"], local.date().isoformat()], separators=(",", ":"))
        key = hashlib.sha256(key_material.encode("utf-8")).hexdigest()
        request("POST", mail_url, "/v1/messages", mail_token, body, key)
        sent.append(office["id"])
    return sent


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("offices")
    parser.add_argument("--now", help="ISO-8601 instant, normally omitted")
    args = parser.parse_args()
    with open(args.offices, encoding="utf-8") as file:
        offices = json.load(file)
    now = datetime.fromisoformat(args.now) if args.now else datetime.now(timezone.utc)
    print(json.dumps(send_reminders(offices, now, os.environ["PLANNING_URL"], os.environ["PLANNING_TOKEN"],
                                   os.environ["MAIL_URL"], os.environ["MAIL_TOKEN"])))
