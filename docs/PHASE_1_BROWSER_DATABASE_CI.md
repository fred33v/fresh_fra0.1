# Phase 1 — Authenticated browser/PostgreSQL CI

The existing Database (PostgreSQL) job now installs Chromium and runs a browser journey against a separate real backend process and the job's disposable PostgreSQL database. It remains part of the existing required check; no sixth required-check name is introduced.

## What is exercised

The Chromium journey submits the real sign-up form, consumes the backend's development-only confirmation token, confirms the account and signs in. It edits the department through the real profile form, reloads the page, and independently queries PostgreSQL to prove persistence. It checks both the browser admin-route guard and a server-side administrator-only operation, signs out, verifies the protected-route redirect, signs in again and observes the persisted department.

There are no route interceptions, fake API responses, seeded browser tokens or mocked authentication in this suite. It checks that the real health endpoint reports database connectivity before exercising the flow. The small direct SQL verification uses the backend's existing `pg` installation rather than adding a database driver to the frontend dependencies.

## Isolation

- The suite requires `BROWSER_DATABASE_TEST=1` plus an explicit database URL.
- The target must be `localhost` or `127.0.0.1`, with database `fra` or `fra_browser_test`. Remote hosts, other database names, URL query overrides and fragments are refused before server startup.
- Dedicated loopback backend/dashboard ports 3008/8088 are used; existing servers are never reused.
- The backend receives the same local URL for pooled/direct variables, separate fixture JWT secrets, empty SMTP/Stripe/Redis credentials, disabled webhook polling and disabled destructive retention.
- Account emails/passwords are generated fixtures. Email confirmation uses the development response, not an external email service. No real payment, message or production account is used.
- Each run creates new fixture accounts. The database is disposable and is destroyed by CI service cleanup. This suite does not delete data from any supplied database.

Nine unit cases cover the opt-in requirement, remote/ambiguous destinations, URL host/port overrides, non-disposable names and accepted local fixtures. The ordinary mocked UI suites remain separate; they do not silently become database tests.

## Running

From `apps/fra-web-dashboard`, with an already migrated disposable local PostgreSQL database:

```bash
BROWSER_DATABASE_TEST=1 DATABASE_URL=postgresql://fra:fra-ci-only@localhost:5432/fra pnpm test:e2e:database
```

Install Chromium first with `pnpm exec playwright install chromium`. An optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects an existing Chromium installation for local checks. CI installs its own supported browser and dependencies. The config controls backend/dashboard origins and credentials; it accepts no remote API URL.

## Evidence and scope

The earlier PR #78 head `cc9ac01` passed all five existing checks in [CI run 43829172095](https://github.com/fred33v/fresh_fra0.1/actions/runs/43829172095). That run predates this browser-CI addition.

Local validation for this addition uses PostgreSQL 17 in a disposable loopback-bound Docker container, all 35 migrations, and real Chromium. E2E TypeScript, test TypeScript, changed-file lint and the nine guard unit cases pass. The browser journey passed twice consecutively against the same disposable database with unique fixture accounts (`--repeat-each=2`, 31.8 seconds). It waits for the profile page’s own reload rather than initiating a competing navigation. Remote CI must confirm this addition on the new head.

This covers a critical authenticated Web/backend/SQL path, not every product journey. Real provider payments/email, deployed TLS/nginx behavior, remaining product/browser coverage, organisation-wide visibility/retention policy and final Phase 1 acceptance remain separate gates. No production migration or deployment is performed by this change. Native mobile development stays suspended.
