# Phase 1 — Account-link and browser-session concurrency

Prepared on 13 November 2026. This change addresses R01/R02 from the completeness review; it does not complete Phase 1 or deploy anything.

## Result

Password-reset and email-confirmation routes now atomically consume their link before changing an account. Redis uses GETDEL; the in-memory implementation reads/deletes without yielding. Existing key formats, expiry rules, URLs and response envelopes are preserved, so outstanding links do not require a token-format migration. The old lookup/delete helpers remain exported for compatibility; these routes no longer use their nonexclusive pair.

For PostgreSQL, confirmation, required audit and refresh-session creation commit together. Password update, email confirmation, removal of existing refresh sessions and required audit commit together. Both operations lock the user row, as does refresh rotation, so a concurrent refresh cannot insert a surviving replacement session after password reset invalidation. Password-change notification starts after commit. Already-issued access JWTs retain their existing expiry behavior; this does not introduce an access-token revocation service.

**Failure policy:** link consumption and the PostgreSQL transaction are separate storage operations. A claimed link stays consumed when account processing fails; database changes roll back, and the API returns a safe instruction to request a new link. This intentionally fails closed rather than attempting a cross-store rollback/replay. An interrupted or lost response can also require a new link. No distributed Redis/PostgreSQL transaction is claimed. Account links stored only in the existing memory fallback still do not survive process restarts or cross-worker routing.

The dashboard now uses the origin's Web Locks API to coordinate refresh across independent tabs where supported. Queued tabs reuse the preceding rotation. A session marker distinguishes token rotation from logout/new login; stale responses cannot restore a logged-out session, overwrite a new account, or retry the original request as that new account. Transient network/server errors no longer clear stored credentials.

Without Web Locks, requests still compare the attempted session/token with current storage before applying results. A refused fallback refresh retains its attempted credentials so an in-flight peer can finish. If no peer succeeds, the failed request tells the user to sign in again; retained invalid credentials confer no access because the server refuses them. This fallback does not claim origin-wide mutual exclusion. A peer's already-written replacement credentials are reused, never erased by a stale refusal.

## Verification

- New account-link tests cover concurrent reset, concurrent confirmation, expiry/missing users and consumed-link behavior. A separate mocked Redis contract test verifies GETDEL and the retained key formats; no live Redis server was exercised here.
- PostgreSQL transaction integration now has 17 scenarios (12 existing plus five account/session cases): reset rollback including audit/session deletion; one successful concurrent reset; reset racing refresh leaves no refresh session; confirmation rollback on session-insert failure; and one successful concurrent confirmation. These passed against disposable PostgreSQL 17.7. Account links used the backend's memory fallback in that integration process.
- Seven dashboard unit cases cover cross-module lock coordination, stale refusal after peer rotation, logout/new-login races, temporary failures and explicit invalidation with/without Web Locks.
- Two additional actual Chromium two-tab contracts pass, with and without Web Locks. API responses are mocked; they do not represent a live browser-to-PostgreSQL test. The existing two certificate browser contracts pass as well.
- Full backend unit suite: 655 tests across 49 suites pass. Full frontend suite: 733 tests across 65 files pass. Backend build/typecheck and all four frontend TypeScript projects pass; dashboard production build passes. Changed production files and new browser/client test files lint without errors.
- Browser specs are still not invoked by the repository's CI; new Jest/Vitest tests and expanded PostgreSQL integration are picked up by existing CI commands. No fresh GitHub CI result is claimed.

## Deployment and preservation

No SQL migration or dependency-version change is required for this commit. Drain legacy auth handlers before relying on the exclusive link claim: an old worker's separate read/delete path cannot be made safe by a new worker's GETDEL. Existing certificate migration/cutover requirements still apply to the cumulative Phase 1 patch. Reload existing browser tabs to load the updated session client; an already-running old bundle does not gain these safeguards automatically.

Do not apply a cumulative patch twice. The cumulative delivery begins at baseline `5fcfb4d89749a729aae5274d533ee5e337b09d75` and includes transaction/permission, certificate lifecycle, frontend typecheck, and this account/session repair. Use a clean separate checkout or a reviewed incremental commit when previous repairs are already present. The user's existing Mac checkout is outside this work.

## Current remaining order

The original audit and earlier repair documents are historical records. The frontend typecheck gate and account/session findings R01/R02 are now implemented locally; deployment/remote acceptance remains unverified. Next: payment refunds/disputes and durable events, then budget-planning persistence/edit/delete/failure handling, SSE repairs and role alignment, reliable browser CI, release safeguards and explicit visibility/retention policy. Provider recruitment/17% commissions and verified professional signing remain new features on those foundations. Native applications remain preserved and suspended.
