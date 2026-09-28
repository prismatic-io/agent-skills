# Order bridge cutover review

Review as of 2026-09-24 16:00 UTC. This is a rehearsal; do not change either
system or contact the services. The proposed switch window begins at 18:00 UTC.

The private API contract and legacy worker are under `legacy/`. The candidate
Prismatic port passed local mocked happy-path tests. The migration engineer has
not supplied its checkpoint implementation, an integration export, or a live
execution history. A screenshot reportedly shows a disabled five-minute
schedule. No platform API verification has been made.

The old host is still polling successfully. The file in this packet was copied
while cron was enabled. Operator B plans to stop the old cron entry at 18:00;
the wrapper holds its flock until its process exits. We do not yet have the
stop confirmation or a final cursor file. The old deployment and secret-manager
entries will remain available for 48 hours after the switch.

Customer account in scope: shop-west, paired with fulfillment-west. Staging uses
a separate account and cursors are account-specific. Operators may not infer a
cursor from wall-clock time. Source retention is seven days; an expired cursor
requires the feed owner's resynchronization procedure rather than ordinary
polling. We do not have that resynchronization procedure yet.

The checkpoint packet contains both today's copied file and an older recovery
snapshot. The new port team suggested using the recovery snapshot because it
was marked verified. Please assess that suggestion and give us an executable
human runbook with stop/go checks, state handoff, observation, and rollback
conditions. Identify what evidence is missing and who can provide it. A small
local rehearsal or checklist validator is useful if it demonstrates a specific
handoff property; do not invent production endpoints or Prism state-write APIs.

Owners: Operator B controls cron and the persistent cursor volume; the migration
engineer owns the candidate Prismatic integration; the feed owner can confirm
cursor validity; fulfillment operations can reconcile destination orders.
