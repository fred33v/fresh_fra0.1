# Neon PostgreSQL setup status — 13 November 2026

## Configuration prepared

The local `.neon` link targets organisation `org-autumn-queen-65017202`, project `patient-surf-03013684`, branch `production`. The CLI generated `neon.ts`; PostgreSQL is the requested service and the existing application authentication is retained. The remote project/branch identity was not authenticated through the Neon API.

The root now declares `@neon/config` and `@neon/env` with the pnpm lockfile updated. The backend remains Node/Hono with `pg`, following the official Neon/Neon PostgreSQL skill guidance. No serverless HTTP transport is substituted into the application.

The backend loads root environment files produced by Neon, while preserving injected/package settings. `DATABASE_URL_UNPOOLED` is selected only by the migration runner; a pooled migration target is refused. Connection pairs from different configuration layers are not silently combined. Unit tests skip automatic environment loading. The read-only probe is available as the backend's `db:check` script.

The user-supplied database URL is stored only in ignored `.env.local` with mode 0600. Its direct counterpart was derived from the supplied Neon endpoint naming convention; it has not been independently tested. No credentials are included in this document or staged in Git.

## Commands and evidence

1. `npm i -g neon@latest` failed because the configured global prefix was not writable. The requested `npx neon@latest` fallback ran CLI 9.4.0.
2. The requested `neon init -y ... --services postgres` wrote the local link and config offline. Dependency installation initially failed on pnpm's workspace-root guard; `pnpm add -w @neon/config @neon/env` using pnpm 9.15.4 completed. Automatic agent plugin installation failed on inaccessible home cache directories. Official skills were read from a temporary checkout of `neondatabase/agent-skills`.
3. `neon deploy` could not authenticate. Browser authentication timed out after 60 seconds, including the retry after the user reported signing in. No API session or `NEON_API_KEY` was available in this workspace. No remote deployment/provisioning success or automatic env pull is claimed.
4. `npm run build` passed using a workspace-local shim selecting pinned pnpm 9.15.4 (the environment's default pnpm version failed). Output:

```text
Tasks:    5 successful, 5 total
Time:     25.517s
```

Turbo warned about missing declared output files for shared/types builds. They still completed successfully.

Targeted Jest validation also passed: 50 tests across four suites (environment loading, TLS configuration, production environment and migration safety). Backend TypeScript passes; changed-file lint has no errors, with two existing unused-import warnings in `index.ts`.

5. Native production TLS probe, inside and outside the sandbox:

```json
{"ok":false,"stage":"connection","code":"ECONNREFUSED"}
```

This proves a connection failure from this environment, not its exact cause. Neither native TLS nor PostgreSQL authentication completed.

6. A temporary diagnostic using the official Neon serverless driver and inherited HTTPS proxy succeeded. It was not added as an app dependency and issued only a read-only transaction:

```json
{"transport":"Neon HTTPS diagnostic","probe":1,"read_only":true,"migration_history_present":false,"users_table_present":false,"public_table_count":0}
```

This establishes that the supplied database credentials work over HTTPS and that this database currently has no public application schema. It does not verify that its endpoint belongs to the unauthenticated project ID above, or establish native TCP connectivity.

7. Built app startup on loopback only, with webhook polling disabled:

```json
{"service":"backend","http_status":503,"health":{"status":"degraded","checks":{"database":"error","redis":"not_configured"},"uptime":6,"version":"2.0.0"}}
{"service":"dashboard","http_status":200}
```

Both test processes were stopped. No migration, application data write, external webhook or production application deployment was performed.

## Remaining blockers

- Authenticate the CLI in this exact environment (or supply `NEON_API_KEY` as an environment secret), then verify the project and deployment plan before retrying `neon deploy`.
- Diagnose/enable native PostgreSQL egress to the supplied endpoint on port 5432; `ECONNREFUSED` alone does not identify the responsible network component.
- Validate and apply the repository migrations on the intended database using a tested direct connection and the existing launch/snapshot procedure. The database has no application tables yet, so authenticated application journeys cannot pass.
- Finish the rest of the production configuration, including Redis, before claiming production readiness. Rotate the database password shared in chat.

The build and HTTPS read-only query passed. A working application-to-PostgreSQL end-to-end flow has **not** been demonstrated.

## Authenticated deployment follow-up — 13 November 2026

This supersedes the earlier API-authentication and project-identity blockers. The user supplied a Neon API credential, kept out of Git and tool output. The CLI verified that `br-long-sunset-za8gukq9` is the ready/default `production` branch of project `patient-surf-03013684`.

`neon config plan` reported no changes and only Postgres in use. `neon deploy` then completed successfully:

```text
Applying to branch production (br-long-sunset-za8gukq9)
No changes — branch production already matches the policy.
Utilized services: Postgres
Pulled 5 Neon variables into .env.local
```

The five names are `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`, `NEON_BRANCH_ID` and `NEON_FUNCTION_HOST_SUFFIX`. Branch metadata matches production and the supplied branch ID. The environment file was restricted to mode 0600 after the pull. The direct URL is now the official CLI-provided value, replacing the earlier derived value.

Using the freshly pulled values:

- `npm run build`: **5 successful, 5 total**, **23.611s**.
- HTTPS read-only diagnostic: probe 1, read-only true, public table count 0, no users table or migration history.
- Native pooled and direct PostgreSQL probes: **ECONNREFUSED**.
- Built backend `/health`: **503**, database error; Redis not configured.
- Built dashboard: **200**.

Both local startup test processes were stopped. No production migration or application-data write was performed. Neon API authentication and config deployment are now confirmed. Native database reachability, schema initialization and full application end-to-end validation remain unresolved; the successful HTTPS diagnostic does not substitute for the native `pg` connection used by this app. Shared credentials must be rotated after configuration.
