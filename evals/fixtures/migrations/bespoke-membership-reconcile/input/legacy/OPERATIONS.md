# Directory bridge

This Node 22 job keeps a training portal's access group aligned with our internal directory group. Both HTTP services are our own gateways, not vendor-native APIs. The script is the running implementation. Operations runs it every fifteen minutes under a singleton scheduler; only one bridge instance may run for an account/group. There are no customer credentials in this packet.

The attached API descriptions are the contracts maintained by our service team:

- Directory: bearer authentication, GET `/v1/groups/{group}/members`, optionally `?cursor={opaque cursor}`. Response `{members: [{id, enabled, kind}], nextCursor}`. A null nextCursor means the complete snapshot was read. Cursors bind all pages to the same snapshot; they are opaque strings, and pages can overlap. IDs are case-sensitive strings, not email addresses. `kind` is `employee` or `contractor`; `enabled` is a JSON boolean. Empty complete snapshots are valid.
- Access: separate bearer authentication, GET `/v1/groups/{group}/grants` returns the complete current `{grants: [{personId, managedBy}]}`. There is at most one grant per person. Some were created by this bridge (`managedBy: "directory-bridge"`); others are manually managed (`managedBy: "helpdesk"`). Helpdesk grants can deliberately outlive directory membership.
- Access: PUT `/v1/groups/{group}/grants/{personId}` with `{managedBy: "directory-bridge"}` atomically upserts a grant; this operation overwrites ownership if the grant already exists. Success is 204. DELETE at the same path atomically removes a grant; deleting an absent grant also returns 204. An individual HTTP request is atomic; a whole job is not a transaction. Successful mutations remain if a later request fails. Methods can return 429/5xx. No automatic application retry is configured.
- Percent-encode each path segment and cursor value. Never forward a bearer token to the other service.

The singleton run is our only automated writer. Helpdesk knows to avoid grant changes during its short run, and to suspend scheduling during emergency edits. The old script exits on the first failed request. Monitoring pages us on nonzero exit; we fix service problems and let the next scheduled run reconcile again. We do not restore a pre-run grant snapshot on failure. We may not have a usable snapshot when directory paging is interrupted, so a failed fetch must not turn into an empty membership list.

We want the host retired, not a policy change: employees retain access, departed employees lose bridge-owned access, and manual exceptions stay with helpdesk. We can provision the two service credentials and group ID at deployment. The fifteen-minute cadence and no-overlap rule still apply in the replacement.
