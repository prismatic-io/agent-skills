# Embedded authentication

Use this note when writing or reviewing the backend token endpoint. The claims,
their meanings, and signing-key setup are in
[Authenticating embedded users](https://prismatic.io/docs/embed/authenticate-users/);
read it for anything not covered here. Checked 2026-09-28.

## Token

Sign an RS256 JWT with the required `sub`, `organization`, `customer`, `iat`,
and `exp` claims. `organization` and `customer` are Prismatic-specific;
`sub`, `iat`, and `exp` are registered JWT claims. Set or verify each required
claim, and check the library's timestamp options: `jsonwebtoken`'s `noTimestamp: true`
removes `iat` even when the payload sets it.

The customer comes from the token, so a wrong `customer` shows one tenant's
integrations to another. Derive it and `sub` from the server-side session.
`customer` must be the external ID the organization uses for that customer in
Prismatic; if the app has no established mapping, ask which tenant field it is.
Set `role` only for user-level configuration.

No token lifetime is required: the docs example uses an hour and the SDK
examples ten minutes. Keep tokens short-lived, follow the app's session policy,
and return the expiry so the browser can re-authenticate before it.

## Signing keys

The private key signs tokens and belongs in the app's server-side secret
configuration; Prismatic keeps only the public key and the private key's last
eight characters. Every way of getting a key changes the organization:

- The **+ Add signing Key** button on the organization's Embedded tab creates a
  key pair and shows the private key once. The UI cannot import a key.
- Prism's signing-key `generate` command does the same. It prints the private
  key unless `--private-key-file <path>` writes it to a new owner-only file,
  and it refuses to print in agent mode. Windows ignores the file's permission
  bits, so use a path in the user's own profile there.
- A pair generated elsewhere, for example with OpenSSL, is registered through
  Prism's signing-key `import` command.

Check the installed Prism's commands and options with `prism --llms` and
`--help`. Secret stores often flatten a PEM's line breaks; test that the
configured key loads.

## Failures

`prismatic.authenticate` throws when Prismatic rejects the token. Common causes
are an unregistered or mismatched key, a wrong organization ID, an expired
token, and a `prismaticUrl` for the wrong region or white-label domain.
