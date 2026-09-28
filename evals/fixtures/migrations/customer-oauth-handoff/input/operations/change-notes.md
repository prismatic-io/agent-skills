# On-call notes, 6 October, 09:00 UTC

The provisional window starts at 10:00 UTC. Legacy jobs and their token refresh
worker are still enabled for all three customers. Nobody has taken a final token
snapshot. We do not have a verified statement about refresh-token rotation for
this CRM provider or whether the old and new applications can use the same grant.
The exports do not include access tokens, refresh tokens, scopes, expiry values,
additional token fields, or Prismatic resource IDs.

The change ticket currently has these tasks: export the vault records, populate
the target CRM connection, run a connection check, and switch the scheduled jobs.
It does not yet specify resource IDs, how to carry forward the target settings,
or when each system takes responsibility for refreshing credentials. The ticket
template has a `refreshAt` field with no value. Support has asked whether retaining
the old service for a day would let them switch back if customers report trouble.
No migration commands have been prepared or run.

Platform reference linked from the ticket:
https://prismatic.io/docs/api/common-queries/updating-config-variables/

Mina (platform) owns target instance/configuration discovery and the published
integration version. Luis (legacy service) owns the vault export and can stop
the scheduler and refresh worker in the window. Ava (support) owns customer
communication. Provider administration is owned by the security team, who have
not yet confirmed the OAuth app and grant details.

The target integration includes a deployment hook that registers a CRM webhook.
Its account selection and cleanup behavior have not been reviewed. No live target
tests or refreshes have been observed by this team.

The old service can be retained for 48 hours. Whether its saved credentials would
still work after the target refreshes is unknown. We need a rollback decision
that does not depend on blindly restoring an old vault value.
