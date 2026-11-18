# Phase 1 — certificate lifecycle and issued evidence

This repair follows local transaction/permission commit `dd02867326a41666c0d28a959ed45f13e2e7f5ff`, based on main `5fcfb4d89749a729aae5274d533ee5e337b09d75`. Local verification: 12 November 2026. Neither repair has been published through the blocked GitHub write connection.

## Result

- Public verification distinguishes valid, revoked and unknown references. Malformed references still return a safe 400; unknown references retain their 404 response contract.
- An administrator can revoke a certificate from their own organisation at `/certificate/manage`. The server rechecks the current persisted role/organisation, so an old admin JWT cannot retain authority after a role change. Other tenants see 404. There is no public role-assignment endpoint.
- Revocation records a private reason, actor and timestamp in PostgreSQL. The status update and audit event commit together. Repeated requests preserve the first decision and do not create another revocation event. Revoked PDFs cannot be downloaded or automatically replaced.
- Migration `032_certificate_lifecycle.sql` adds a verification registry containing immutable issued details. Existing certificate tables, references and duplicate legacy records are retained.
- New records capture the recipient/organisation, course or assessment title, course version, completion date, issue date and quiz score. Profile and title changes no longer rewrite the certificate at its reference.
- New training issuance is canonical per recipient/course/version, protected by a transaction lock and unique key. It uses the exact qualifying progress/session. Original certificate row, snapshot and required audit roll back together on failure.
- Every section and quiz is required. The pass mark remains **80%**. There are four equally weighted quiz questions, so 75% fails and the attainable passing score is currently 100%.
- Assessment verification survives retention/deletion of the original assessment because the evidence registry has no cascading source foreign keys.
- Training preview/share uses issued details rather than a later profile name. Public verification never returns internal user/organisation/source IDs or private revocation reasons.
- PDFs use the snapshot and show separate completion and issue dates. Entity-looking names render literally to match verification. Long names/organisation names wrap without clipping. QR links remain unchanged.

## Legacy evidence and version policy

Legacy references are backfilled once and labelled `legacy_reconstructed`. Names are the best available details at migration time, not a claim about a historic name. Training completion dates/course versions that were not recorded remain unknown. Existing legacy validity is preserved; the migration does not silently revoke old certificates or claim that they passed today's quiz policy.

Legacy duplicates remain addressable individually. New canonical issuance requires today's server-side eligibility rules. The initial explicit training course version is `2026-10-30`, aligned with the existing quiz/pass-mark policy. Future content/eligibility versions need a deliberate version change and their own reviewed rules.

If training and assessment source tables contain the same public reference for different certificates, migration 032 refuses atomically. It does not silently choose a winner, overwrite a reference or delete either source record. Reconcile that ambiguity before retrying.

Snapshots and ownership cannot be updated in place. Correction/reissue requires a separate reviewed workflow; this patch does not grant professional signing authority, external accreditation, automatic reinstatement or an exception to quiz eligibility. Certificate retention/privacy policy remains a separate owner decision; no new automatic deletion is enabled.

## Deployment requirement

Migration 032 must be applied before the new backend serves certificate requests. Use the direct database connection, a database snapshot and the existing launch runbook.

This is a **coordinated cutover**, not a mixed-writer rolling release: pause/stop the old backend, including assessment-triggered certificate issuance, apply the migration, deploy the new backend/dashboard, then resume traffic after smoke checks. An old backend can insert into the retained source tables without creating a registry snapshot. Do not resume an old certificate writer after the backfill, or use an automatic old-code rollback while issuance remains open. Keep issuance paused until a registry-aware version is restored; preserve the additive schema and evidence records.

No production migration, deployment, real certificate revocation or real payment was performed here.

## Verification

- Full backend suite: **650 tests, 47 suites passed**. After the final role/HTML/layout hardening, the **16 certificate tests** were rerun and passed.
- Full dashboard suite: **723 tests, 62 files passed**.
- Browser UI contracts: **2 Playwright tests passed** for valid/revoked/not-found verification at mobile width and admin confirmation/role redirect. These mock API responses; they are not presented as a live browser-to-PostgreSQL login test.
- PostgreSQL **17.7** certificate integration: **11 scenarios passed**, including atomic legacy collision refusal, duplicate preservation, immutable snapshots, quiz/session eligibility, concurrent issuance, stale admin-role refusal, one-way/idempotent revocation, issuance/revocation failure rollback, source retention, real PDF generation and public rate limiting.
- Existing PostgreSQL API smoke: **106/106 checks passed**; that broad smoke retains its PDF skip, while the dedicated certificate integration renders actual PDFs.
- Actual training, assessment and 200-character name PDFs: one landscape A4 page each; names, titles, dates and references verified by text extraction and pages visually inspected. All three rendered QR codes were decoded and matched their exact verification links.
- Local PDF/browser tests used headless Chromium 153 with the unchanged Puppeteer renderer because ordinary Chromium's process socket is restricted in this environment. This temporary test browser is not a project dependency. CI installs the browser pinned by Puppeteer before running the new PostgreSQL/PDF script.
- Backend typecheck/build and dashboard production build passed. Changed production files lint without new errors; backend-wide lint retains five existing warnings. Manifest/lockfile versions were not changed.
- The new database checks are wired into the existing PostgreSQL CI job. Remote CI on these unpushed commits remains pending.

### Newly discovered gate gap — next priority

The dashboard root `tsconfig.json` has `files: []` and project references. Its current `tsc --noEmit` script succeeds without actually checking the referenced application project. Running `tsc -p tsconfig.app.json --noEmit` exposes inherited errors, including missing test globals and application-source type errors.

The untouched `5fcfb4d` worktree and this repair were checked with the same installed dependencies. Excluding test files, **both have the same 16 application-source diagnostics, with zero new application-source diagnostics from this repair**. The test configuration also has pre-existing diagnostics; new test code has not been represented as a clean full-project typecheck.

Fix the application/test TypeScript projects and make CI run the real checks before treating a green dashboard typecheck as an acceptance gate. This patch does not hide/exclude the existing failures, weaken compiler settings or claim that full frontend typechecking passed.

## Run the certificate PostgreSQL checks

From `apps/fra-backend/backend`, use a disposable local PostgreSQL database with all migrations applied:

```bash
CERTIFICATE_TEST_DATABASE=1 DATABASE_URL=postgresql://... node scripts/certificate-integration.mjs
```

The script requires non-production mode and a local host, starts its own backend with test-only secrets, creates/removes a separate disposable legacy-migration database, and uses targeted failure-injection triggers. It needs a usable Puppeteer/Chrome installation and permission to create a temporary test database. Do not point it at important data.

The next repair priority is the frontend TypeScript gate, followed by durable payment events and refund/dispute reconciliation. Provider recruitment, 17% commissions and verified professional signing remain separate work.
