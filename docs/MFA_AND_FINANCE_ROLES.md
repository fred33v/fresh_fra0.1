# MFA and separate finance authority

Migration 047 builds on 046 and adds encrypted TOTP enrollment, replay protection and database-backed finance role grants. No production account, secret or role was changed during development.

## Login and enrollment

Every enrolled account must supply its password and a fresh six-digit authenticator code at `/auth/login`. Enrollment is optional for ordinary users and mandatory before protected API access for administrators, facilitators, accounts in the configured operator organisation and finance role holders. These checks use persisted identity and MFA state, not a client-selected role.

Existing privileged accounts initially receive a restricted password session: `/auth/me`, logout and security enrollment remain available, while protected functionality returns `MFA_ENROLLMENT_REQUIRED`. The dashboard redirects them to `/security`. Enter the current password, manually add the displayed private key to an authenticator app using time-based SHA-1, six digits and 30 seconds, then confirm its code within ten minutes. Sign in again with a fresh code. Codes already accepted cannot be reused, including the enrollment confirmation code.

Seeds use the existing private AES-GCM keyring with distinct `mfa:USER_UUID` authenticated context. Configure `FINANCE_VAULT_KEYS_FILE` as described in FINANCE_DETAILS_AND_FEES.md before rollout; production requires the mounted private file. Keep all key versions securely backed up. No seed is returned after enrollment. Keep the setup key private; it must never appear in chat, logs or support tickets.

Verification accepts one adjacent time step for clock drift. Five incorrect/replayed attempts lock the database-backed factor check for five minutes, across server replicas. Endpoint rate limits also protect enrollment/confirmation. Missing security state infrastructure fails closed in production. This is TOTP, not phishing-resistant WebAuthn/passkeys.

The web client does not automatically refresh or replay rejected password logins or one-use MFA confirmations; the original authentication error remains visible. Ordinary expired-session refresh remains available.

Access and refresh tokens carry the MFA version and original authentication time. Refresh preserves that time and cannot turn a password-only session into an MFA session. Enrollment revokes existing refresh tokens; changed MFA versions invalidate older access tokens. Password reset and email verification do not bypass the protected API checks. MFA is not requested interactively from API keys; privileged machine principals without MFA evidence are denied by the current guard, so plan machine-account access separately before rollout.

## Finance role

The existing coarse account roles remain for their established responsibilities. `user_security_roles` adds an independent, revocable `finance` capability. It can be held by a verified operator employee without granting admin, recruitment-review or certification authority. The previous `FINANCE_AUTHORISED_USER_IDS` environment list no longer authorises finance actions and is not imported automatically.

An operator admin with a current MFA login can use `/security` or POST `/api/v1/security/roles/finance` with `{userId, action: "grant" | "revoke", reason}`. The target must be another verified operator account. Self-grants/revocations are prohibited. For initial setup, admin A enrolls and grants finance to verified operator B; if A also needs finance, a second enrolled operator admin must grant it independently. Never seed production grants by copying test fixtures.

The grant/revocation history is append-only. Finance authorisation checks the current grant, verified account, operator organisation, enabled MFA version and authentication time inside the business transaction. Finance operations and role administration require MFA authentication within 15 minutes; sign out and log in again when it expires. Revocations affect subsequent requests immediately. Independent payout approval restrictions remain in force even for finance users.

This applies to bank review/reveal, fee and payroll administration, commission statement review and commission preparation/approval/recording. Administrators keep unrelated recruitment and administrative permissions, but the admin role alone cannot settle commissions. Existing admin sales reporting remains its separate read permission. The 17% ledger and formula are unchanged.

## Lost authenticator recovery

There is no email-code fallback, automatic MFA disablement or self-service bypass. Recovery requires a trusted operational terminal with database access and independently checked identity. The script defaults to a dry run:

```sh
# Run from apps/fra-backend/backend. Use real UUIDs and a non-sensitive case reference.
node --import tsx scripts/mfa-recover.mjs USER_UUID INDEPENDENT_OPERATOR_ADMIN_UUID "Identity verification case and recovery reason"
```

Only after independent checks, repeat with the final `--execute` argument. The script checks the independent actor is a verified operator administrator; the operator running it remains responsible for authenticating that actor and checking the case. It increments the MFA version, clears the old seed, revokes refresh tokens and records an immutable recovery event. The user must enroll a new authenticator before resuming access. This is an administrative recovery procedure, not automatic identity verification. Do not expose it as a public endpoint.

## Rollout and validation

Review this stacked change after PR #100, apply additive migration 047, configure the keyring, then have privileged accounts enroll and independently assign finance grants before enabling payment operations. Existing allowlist-only finance users intentionally lose access until granted the new role. Keep a tested independent administrative recovery path. No real payment, production migration or account enrollment is performed by the automated tests.

PostgreSQL integration exercises enrollment, expired/used codes, mandatory privilege gates, finance role separation, self-grant denial, live revocation, durable lockouts, refreshed-token evidence and session invalidation. Existing finance and commission regressions use synthetic MFA fixtures; dedicated MFA tests exercise actual password login and enrollment routes. Unit tests include RFC 6238 vectors. Frontend tests cover setup, clearing the displayed secret and denied role updates.

Validation recorded for this change:

- Fresh PostgreSQL 17 migration through 047; 43 real MFA/role HTTP requests, including independent recovery dry-run/execution and expired enrollment.
- Five finance integration scenarios and 98 existing recruitment/commission checks passed with the new authority requirements.
- Eleven certificate lifecycle/PostgreSQL/PDF scenarios passed, including actual Chromium rendering and legacy migration compatibility.
- Backend: 803 tests across 66 suites passed. Frontend: 795 tests across 75 files passed.
- All five build tasks and frontend/backend type checks passed. Each application linter reports five pre-existing warnings and zero errors.

The stacked PR's base is the finance-beneficiary feature branch. Hosted workflows currently target main; these are local test results, not a hosted CI claim.

Follow-up client review: three regression cases verify that refused password/MFA attempts are sent once, preserve their original error and do not rotate stored credentials. The focused authentication/session suite passes 69 tests; frontend type checking and production build also pass for this follow-up.
