# Stop FRA architecture

## Overview

One API serves every client. The web app and the three Expo apps all talk to `apps/fra-backend`
over HTTPS and JSON. There is no second backend: the web app used to use Supabase and no longer
does (the old `apps/fra-web-dashboard/supabase/` folder is a leftover).

```
  Web app (Vite, React)      Mobile app      Training app      Budget guide
  S3 + CloudFront            Expo            Expo              Expo
          \                      |               |                /
           \_____________________|_______________|_______________/
                                 |  HTTPS, JSON, JWT
                         Application Load Balancer
                                 |
                        EC2: Node API (Hono), systemd
              ___________________|___________________________________
             |          |            |           |          |        |
         PostgreSQL   Redis        Stripe        SES         S3     Chrome
         (Neon)     (Upstash)     Checkout     (email)   (uploads,  (PDF
                                                          backups)  reports)
```

## The API (`apps/fra-backend/backend`)

- **Framework:** Hono on Node 20+, written in TypeScript. Routes are in `src/routes`, data access in
  `src/db`, and shared rules (scoring, entitlements, risk modules) in `src/*.ts`.
- **Database:** PostgreSQL through `pg` with plain SQL and numbered migrations in `migrations/`,
  applied by a tracked runner (`pnpm db:migrate`, or `start.sh migrate` on the server). With no
  `DATABASE_URL` the API keeps everything in memory, which is what local development and most
  tests use.
- **Validation:** Zod on every request body.
- **Rate limiting and lockouts:** Redis when configured, with an in-memory fallback if Redis
  fails. The client address is the one the load balancer appended to `X-Forwarded-For`
  (`TRUSTED_PROXY_COUNT`), never one the client sent.
- **Health:** `GET /api/v1/health` reports the database and Redis. The load balancer and the
  deploy script use it, and so does an alarm.
- **Background jobs** (started with the server): a daily data-retention job, which only reports
  what it would delete unless `RETENTION_ENABLED=true`, and daily reassessment reminders.

### Authentication

- Sign-up creates the account and emails a single-use confirmation link (24 hours). The reply is
  the same for every address, so it does not reveal who has an account. Sign-in is refused until
  the address is confirmed.
- Access and refresh tokens are JWTs signed with two different secrets. Refresh tokens and
  password-reset tokens are stored only as SHA-256 hashes.
- Failed sign-ins are counted per email and address, with a ceiling per account, so a stranger
  cannot lock the owner out.
- Roles: `employer`, `employee`, `admin`. Workshop facilitators are a separate, server-assigned
  role.

### Packages and entitlements

| Package | Price | Term | Key-passes |
|---------|-------|------|------------|
| Starter (`pkg_basic`) | £795 | one-time | 1 |
| Professional (`pkg_training`) | £1,799 | 365 days | 50 |
| Enterprise (`pkg_full`) | £4,995 | 365 days | unlimited |

Prices are before VAT and are the catalogue defaults; the live ones are in the database. Each package includes everything below it. `src/helpers.ts` turns an
organisation's purchases into entitlement windows (renewals stack), and `src/entitlements.ts`
answers what it may use. `GET /api/v1/entitlements` is what the web app reads to decide what to
show.

### Key-passes

An employer issues codes (12 characters from a 32-letter alphabet, about 60 bits). An employee
uses one once on the web `/join` page or in the apps, choosing an email and a password. That
creates an employee account in the employer's organisation and signs them in.

- A code never outlives the package that paid for it, and is refused if the organisation has no
  active package. A one-time Starter does not lift that limit: while a yearly package is active,
  codes stop at its end (renewals already paid for included). A refused code is not burned, so it
  works again after a renewal.
- A code is also refused once the current packages cannot cover another employee, for example
  when Professional (50 key-passes) has ended and only Starter (1) remains.
- `GET /api/v1/keypasses/organisation/:orgId/quota` returns `packageEndsAt`, so the employer page
  only offers validity periods that fit before it.
- Using a code never signs in to an existing account.

### Payments

Stripe Checkout. The API creates a session; the purchase is confirmed when the buyer returns or
when the signed `checkout.session.*` webhook arrives, whichever comes first. In production the
API refuses to start without the Stripe keys, so a missing setting cannot grant packages for
free.

### Other integrations

- **Email:** Nodemailer over SMTP. In production this is Amazon SES, set up by Terraform.
  Outside production the email is written to the log instead of sent.
- **PDF reports:** Puppeteer driving Google Chrome installed on the server.
- **Webhooks out:** signed (`t=…,v1=…` HMAC), with a guard against private and metadata
  addresses. **Webhook in:** `POST /webhooks/assessment-submitted`, off unless
  `INBOUND_WEBHOOK_SECRET` is set, and requires a signature.
- **Audit log:** security-relevant actions are written to `audit_logs`.

## Web app (`apps/fra-web-dashboard`)

Vite, React, React Router, TanStack Query, React Hook Form with Zod, Tailwind and shadcn/ui.
Pages are loaded on demand. The API client in `src/lib/api.ts` keeps the tokens in local storage
and refreshes them. It is built to static files and served from S3 through CloudFront, which adds
a Content-Security-Policy, HSTS and the other security headers.

## Mobile apps

`fra-mobile-app`, `fra-training-app` and `fra-budget-guide` are Expo (SDK 54) and React Native
0.81 with Expo Router. They keep tokens in the device's secure storage and use the same API.

## Shared packages

- `@stopfra/types`: TypeScript types for the API.
- `@stopfra/shared`: API client, secure token storage and the workshop and quiz content.
- `@stopfra/ui-core`: design tokens and accessibility helpers.

## Infrastructure (`infra/`)

Terraform builds it in `eu-west-2`:

- A VPC, an Application Load Balancer, and one EC2 instance running the API under systemd.
  `infra/nginx` holds an example config for setups that add a second proxy.
- S3 for the web app (behind CloudFront), for uploads, and for database backups.
- SES for email, with its DNS records on Cloudflare, which also hosts the site's DNS.
- A nightly encrypted database backup to a versioned S3 bucket that the server can add to but
  never read or delete, a restore script, and CloudWatch alarms that email the team when the
  health check, the error rate, latency, the server or the backup fails.
- Settings and secrets live in AWS Parameter Store under `/fra/backend/`. The server loads them
  at start.

`infra/LAUNCH.md` is the runbook for the first launch.

## Security controls worth knowing

- Production refuses to start with weak, missing or identical JWT secrets, a non-https web
  address, email without TLS, or without Stripe, Redis, SMTP and CORS settings.
- SSH to the server is closed unless specific addresses are listed, and the instance requires
  IMDSv2.
- Request bodies are size-limited, including chunked ones.
- Training certificates are decided on the server: it marks the quiz answers itself and only
  completes the workshop when every section and quiz is done.

## Testing

- API: Jest, mostly against the in-memory mode, plus a CI job against a real PostgreSQL database.
- Web, shared packages: Vitest and Testing Library. Playwright tests live in
  `apps/fra-web-dashboard/e2e`.
- Mobile apps: Jest.

## Decisions

| Decision | Why |
|----------|-----|
| One API for every client | Two backends meant two schemas to keep in step and two places to secure |
| Plain SQL with numbered migrations | Small schema, explicit and easy to review |
| Key-passes tied to the package | A code from an expired package should not add people for free |
| Refresh and reset tokens stored hashed | A leaked database or backup should not hand out sessions |
| Server-side training completion | The certificate counts as training evidence, so a client cannot just claim it |

Last updated: October 2026.
