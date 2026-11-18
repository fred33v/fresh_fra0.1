# Verified PostgreSQL TLS — 13 November 2026

Follow-up to the Web/backend Phase 1 release-safeguard work. This is a local implementation and validation record, not evidence of a deployed database connection.

## Behaviour

Production now always requires database TLS with certificate-chain and hostname verification. Missing `sslmode`, `require` and `verify-ca` are upgraded to verified TLS; `verify-full` stays verified. Explicitly insecure or unknown modes, disabled SSL, malformed/non-PostgreSQL URLs and Unix-socket destinations are refused with safe configuration messages. Duplicate TLS parameters cannot hide an insecure value. The URL itself and credentials are not included in these errors.

The actual `pg` driver reparses connection strings and can override a Pool's SSL object. The connection builder validates the production URL, loads any custom root/client certificate/key, removes the TLS query parameters, and provides an explicit `rejectUnauthorized: true` SSL object. It installs no custom hostname-verification override. Unrelated URL options and credentials are preserved. Certificate read errors report only the parameter name. Local development and CI plaintext database connections outside production retain their existing behaviour.

## Validation

- 42 tests pass across production environment and new database TLS suites.
- Tests instantiate the real `pg.Client` and inspect its effective parsed TLS options, including libpq compatibility, implicit TLS, legacy require, duplicate weak settings, custom CA loading and the pool factory.
- Tests verify refusal of insecure/invalid settings, safe errors, custom certificate-path preservation and unchanged local plaintext configuration.
- Backend TypeScript and changed-source lint pass; `git diff --check` passes.

No live PostgreSQL TLS handshake, production certificate verification, migration execution or remote CI is claimed. No production connection or deployment was attempted. The earlier 698-test backend run predates this TLS change; it is not a full-suite result for this commit.

## Rollout

The launch guide and Terraform examples now recommend `sslmode=verify-full`. Check that the production server trusts the database certificate and that any supplied certificate paths exist on that host before rollout. Servers without trusted certificates or TLS will fail rather than fall back to plaintext. This change requires no migration, native work or dependency update.

Webhook DNS-address pinning and explicit data visibility/retention policy remain separate open tasks. This database repair does not claim to resolve them.
