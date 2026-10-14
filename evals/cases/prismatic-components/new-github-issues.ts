import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Build a connector with an action to list issues in one repository and a trigger that checks every few minutes for new or updated issues, including closed ones. On the first check, establish a baseline without notifying me about old issues. After that, notify me once per issue update, including updates beyond the first page. Pull requests should never count. Two different issues updated in the same second must both be noticed, even if one first appears on the next check. If a check fails partway through, retry without losing updates. I can provide a repository read token later. Background is in service.md.",
  ),
  fixtures: "../../fixtures/specs/github-issues",
  assertions: [
    {
      ...suite.operations,
      criteria:
        "list repository issues including closed issues and excluding pull requests",
    },
    {
      ...suite.trigger,
      criteria:
        "scheduled polling that emits new or updated issues after a silent initial baseline, follows pagination, excludes pull requests, and persists progress safely across repeated polls",
    },
    {
      type: "rubric",
      id: "polling-correctness",
      criteria:
        "Review the registered trigger behavior. Persisted state must survive invocations, cover the baseline’s pages when initialization is paginated, and distinguish issue identity plus update version. Handle distinct IDs at the same timestamp across polls, including the initial baseline boundary. Equal-time results are permitted by the API; exact-watermark queries with identity/version deduplication are valid, as are overlapping queries. Do not mandate subtracting time. Grade recovery behavior rather than a particular commit strategy: after a later-page failure, every pending update must remain deliverable on retry. SDK batchTrigger dispatches returned pages independently even if a later page fails, so advancing progress for those delivered pages is valid; do not require atomic whole-poll commits. An interrupted initial baseline must remain in baseline mode across fresh scheduled retries, suppressing remaining historical records until the baseline is complete. The user requested no historical emissions, state=all semantics, no pull requests, and updates beyond page one. Equivalent safe baseline strategies are acceptable; do not require scanning all historical pages when a different strategy demonstrably preserves the same invariants. No specific watermark layout or SDK helper is required; minor duplicate risk after a platform crash need not be solved. The supplied endpoint is GET https://api.github.com/repos/{owner}/{repo}/issues: state=all, sort=updated, direction=asc, since ISO timestamp, per_page up to 100, with Link next-page URLs. Results expose id, number, title, state, updated_at and html_url; pull_request marks pull requests. Timestamps have second precision. Bearer repository Issues-read tokens are valid; 401/403 are failures.",
    },
  ],
});
