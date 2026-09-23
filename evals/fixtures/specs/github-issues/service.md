# Repository issues

API reference: https://docs.github.com/en/rest/issues/issues#list-repository-issues
Pagination: https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api
Authentication: https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api

These are independently authored notes for this fixture, checked 2026-09-23.
Use GET https://api.github.com/repos/{owner}/{repo}/issues. The repository endpoint
includes pull requests (identified by a `pull_request` property). `state` defaults
to `open`; `all` includes closed issues. `since` selects issues updated after an
ISO 8601 timestamp. `sort=updated` and `direction=asc` are supported. `per_page`
can be at most 100. A response's Link header can provide the next page URL.
An issue includes id, number, title, state, updated_at, and html_url. Timestamps
have second precision. Equal timestamps on distinct issues do not identify the
same issue. A fine-grained token needs repository Issues read permission;
public repositories also allow unauthenticated reads. Requests can use a Bearer
token, Accept: application/vnd.github+json and X-GitHub-Api-Version: 2022-11-28.
HTTP 401/403 must not be treated as an empty successful result.
