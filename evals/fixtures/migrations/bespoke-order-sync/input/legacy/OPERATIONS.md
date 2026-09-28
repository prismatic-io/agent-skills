# Order bridge handover

This is a constructed, executable example of a small privately maintained
integration, not an export or claim about any vendor's API. It uses Node 22's
built-in fetch and filesystem APIs; no packages are needed. Customer data and
URLs are synthetic. The script and these notes are the source materials handed
to the migration team; no original production system is available.

The shop's change feed is polled every five minutes. The Linux host runs one
copy, under flock, and stores its cursor on a persistent volume. There is one
shop account and one fulfillment account. Tokens come from the host's secret
manager. The sample environment file documents their names, not usable secrets.

Run with the environment variables in `environment.example` and
`node order-sync.mjs`. Provision the cursor directory before starting. The
cron entry on the old host is:

```
*/5 * * * * /usr/bin/flock -n /var/lock/order-sync.lock /opt/orders/run-order-sync
```

The wrapper loads secrets and environment, changes directory, and runs Node.
Nonzero exit status pages the operator through the host's job monitor. There
is no separate dead-letter store. Operators repair invalid source records before
restarting the job. Preserve that fail-and-replay behavior unless an owner agrees
to a different policy. A missing cursor file starts from INITIAL_CURSOR; a corrupt
file must be investigated rather than treated as a new installation.

The fulfillment service is responsible for deduplicating PUTs by external ID.
Replaying a PUT updates that order and does not create another fulfillment task.
The local file is not a record-level transaction with that service. A failed page
is replayed, including earlier successful PUTs on that page. Completed pages do
not need replay after a normal process restart. This integration only forwards
paid orders; it does not retract an already forwarded order when later cancelled.

For a cutover, the operator can stop cron and supply the last cursor file. No
credentials or actual checkpoint are included in this handover. Endpoint reachability,
account permissions, and continuity of the source feed must be checked before
production activation. Example payloads are in `sample-page.json`.
