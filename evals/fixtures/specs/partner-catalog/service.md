# Partner Catalog API, version 1

This document describes the Partner Catalog API. The example .invalid host is
not live; use mocked HTTP calls until account credentials are available.

Base URL: https://catalog.partner.invalid/v1

Our partner issues a client ID and client secret for each customer account.
There is no browser sign-in or authorization URL. Exchange these credentials
at POST https://catalog.partner.invalid/oauth/token with an
application/x-www-form-urlencoded body containing grant_type=client_credentials
and scope=catalog.read. Authenticate that request using HTTP Basic with the
client ID and secret. Success is JSON: {"access_token":"example-token",
"token_type":"Bearer","expires_in":3600}. Invalid credentials return HTTP 401
with {"error":"invalid_client"}. There is no refresh token; obtain another
access token after expiry. Resource requests use Authorization: Bearer <token>.

GET /products returns {"products":[{"id":"p1","name":"Notebook","price":12.5}]}.
GET /products/{id} returns {"id":"p1","name":"Notebook","price":12.5}.
IDs are opaque strings and must be safely represented as one path segment.
There is no pagination in this version. A missing product returns HTTP 404 with
{"error":"not_found"}; an expired token returns HTTP 401 with
{"error":"invalid_token"}. Credentials and tokens must not appear in logs or
connector outputs.
