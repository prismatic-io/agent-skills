import { resolve } from "node:path";
import { defineComponentCase } from "./_component-case.ts";

export default defineComponentCase({
  id: "new-github-issues",
  service: "GitHub repository issues",
  fixture: resolve(import.meta.dirname, "../../fixtures/specs/github-issues"),
  request:
    "Build a connector with an action to list issues in one repository and a trigger that checks every few minutes for new or updated issues, including closed ones. On the first check, establish a baseline without notifying me about old issues. After that, notify me once per issue update, including updates beyond the first page. Pull requests should never count. Two different issues updated in the same second must both be noticed, even if one first appears on the next check. If a check fails partway through, retry without losing updates. I can provide a repository read token later. Background is in service.md.",
  persona:
    "You build integrations in Prismatic’s low-code designer and do not write code. You want the requested connector, have no architectural preferences, and can supply real service credentials later. Use mocked service calls now and publish only to the authenticated Prismatic sandbox. The supplied service contract is the source of truth for this exercise.",
  operations: [
    "list repository issues including closed issues and excluding pull requests",
  ],
  trigger:
    "scheduled polling that emits new or updated issues after a silent initial baseline, follows pagination, excludes pull requests, and persists progress safely across repeated polls",
  tests: [
    "the registered list action returns open and closed issues while excluding pull requests",
    "initial poll creates persistent baseline and emits no old issues",
    "later poll emits a new issue and a changed issue including a closed issue, while filtering pull requests",
    "second page is included",
    "unchanged issue is not re-emitted and two distinct IDs with the same timestamp are both emitted even when one is observed on a later poll",
    "failure on a later page followed by retry loses no issue updates; SDK-supported per-page dispatch with persisted progress is valid",
    "initialization establishes a silent baseline with correct timestamp-boundary behavior, and a fresh retry after failed initialization still suppresses historical issues. Coverage may combine silent-baseline and later-page failure/retry tests when the registered control flow demonstrably shares the same retrieval and failure/commit boundary for initialization and later polls. A separate named combination test is not required in that case. Initialization-specific queries, state changes, per-page commits, or recovery branches need evidence for those distinct boundaries. Mocks must use the actual SDK state semantics; equivalent safe baseline strategies are acceptable",
  ],
  tags: ["polling", "pagination", "persistent-state", "boundary", "token-auth"],
  contract:
    "Authoritative supplied GitHub contract: GET https://api.github.com/repos/{owner}/{repo}/issues supports state=all (otherwise defaults open), sort=updated,direction=asc,since ISO timestamp,per_page<=100, and Link next-page URLs. Results include pull requests marked by pull_request. Issue fields include id,number,title,state,updated_at,html_url; timestamps have second precision. The since filter can return issues at the exact supplied timestamp (confirmed against the public REST API with a one-second-later negative control). Exact-watermark queries plus identity/version deduplication and overlapping queries plus deduplication are both valid; do not require subtracting time. Authenticated Bearer repository Issues-read token is valid; 401/403 are failures. User requires a silent initial baseline, closed/new/updated issues, identity+version deduplication across polls, and recovery from partial-page failure without losing updates. SDK batchTrigger queues each returned page independently, so safe per-page progress is supported; an interrupted initial baseline must remain silent when the next scheduled run starts.",
  criteria: [
    {
      id: "polling-correctness",
      criteria:
        "Review the registered trigger behavior. Persisted state must survive invocations, cover the baseline’s pages when initialization is paginated, and distinguish issue identity plus update version. Handle distinct IDs at the same timestamp across polls, including the initial baseline boundary. Equal-time results are permitted by the API; exact-watermark queries with identity/version deduplication are valid, as are overlapping queries. Do not mandate subtracting time. Grade recovery behavior rather than a particular commit strategy: after a later-page failure, every pending update must remain deliverable on retry. SDK batchTrigger dispatches returned pages independently even if a later page fails, so advancing progress for those delivered pages is valid; do not require atomic whole-poll commits. An interrupted initial baseline must remain in baseline mode across fresh scheduled retries, suppressing remaining historical records until the baseline is complete. The user requested no historical emissions, state=all semantics, no pull requests, and updates beyond page one. Equivalent safe baseline strategies are acceptable; do not require scanning all historical pages when a different strategy demonstrably preserves the same invariants. No specific watermark layout or SDK helper is required; minor duplicate risk after a platform crash need not be solved.",
    },
  ],
});
