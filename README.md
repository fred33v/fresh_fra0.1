# Stop FRA

A fraud risk assessment and awareness platform for UK organisations: a 13-module risk assessment
with scoring, risk registers and action plans, staff training with certificates, access for
employees by key-pass codes, and reports that map to the Economic Crime and Corporate
Transparency Act 2023 (ECCTA) and GovS-013.

It helps an organisation put proportionate fraud prevention procedures in place, record them and
review them. It is not legal advice, an independent audit or a substitute for the organisation's
own counter-fraud function, and using it does not by itself make an organisation compliant.

The code is a pnpm and Turborepo monorepo.

## What is in the repository

| Folder | What it is |
|--------|------------|
| `apps/fra-backend` | The API (`backend/`): Hono on Node, PostgreSQL, Stripe, email, PDF reports. The only backend |
| `apps/fra-web-dashboard` | The web app: Vite, React and Tailwind. Employers, facilitators and employees |
| `apps/fra-mobile-app` | The mobile app (Expo, React Native): assessment, and joining with a key-pass |
| `apps/fra-training-app` | The staff training app (Expo, React Native) |
| `apps/fra-budget-guide` | The budget-holder guide (Expo, React Native) |
| `packages/types` | TypeScript types shared by the apps |
| `packages/shared` | API client, secure token storage, workshop and quiz content |
| `packages/ui-core` | Design tokens and accessibility helpers |
| `infra/` | Terraform for AWS and Cloudflare, nginx, systemd, deploy and backup scripts, and the launch runbook |
| `docs/` | Architecture, compliance notes, guides and training material |
| `reference/` | Source PDFs (GovS-013, ECCTA guidance) |
| `workflows/` | An n8n workflow |
| `.claude/agents/` | Definitions for the AI assistants that help on this repository |

`apps/fra-web-dashboard/supabase/` is left over from an earlier version that used Supabase. The
web app now talks only to the API in `apps/fra-backend`.

## Tech stack

- **API:** Node 20+, Hono, `pg` (plain SQL with numbered migrations), Zod, JWT with refresh
  tokens stored hashed, bcrypt, Stripe Checkout, Nodemailer (Amazon SES in production),
  Puppeteer for PDFs, Upstash Redis, S3.
- **Web:** React, React Router, TanStack Query, React Hook Form with Zod, Tailwind and shadcn/ui.
- **Mobile:** Expo SDK 54, React Native 0.81, Expo Router.
- **Infrastructure:** AWS (EC2 behind an ALB, S3, CloudFront, SES, CloudWatch) managed by
  Terraform, Cloudflare for DNS, Neon for PostgreSQL.

## Getting started

You need Node 20 or later and pnpm 9 (`corepack enable` picks up the version in `package.json`).

```bash
pnpm install
pnpm dev:backend     # API on http://localhost:3000
pnpm dev:web         # web app on http://localhost:8080 (in another terminal)
```

With no `DATABASE_URL` the API keeps everything in memory, which is enough to click through the
whole product. Outside production it prints confirmation and password-reset emails to its log
instead of sending them, and sign-up returns the confirmation token in its response so tests can
finish without an inbox. To use PostgreSQL, set `DATABASE_URL` and run `pnpm db:migrate`. The
variables the API reads are listed in `apps/fra-backend/.env.example`.

The apps:

```bash
pnpm dev:mobile      # Expo, mobile app
pnpm dev:training    # Expo, training app
pnpm dev:budget      # Expo, budget guide
```

## Everyday commands

```bash
pnpm lint
pnpm typecheck
pnpm test            # unit and API tests in every package
pnpm test:e2e        # Playwright tests for the web app
pnpm build
```

## Continuous integration

Every pull request runs lint and typecheck, the tests, a job against a real PostgreSQL database,
and the build (`.github/workflows/ci.yml`). All four must pass before merging.

## Going live

Production does not start with weak or missing settings: the API refuses to boot without the
database, Redis, JWT secrets, Stripe keys, email and web address it needs, and says which one is
missing. The steps to launch, the settings to gather and the checks to run afterwards are in
[`infra/LAUNCH.md`](infra/LAUNCH.md).

## Further reading

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how the pieces fit together
- [`SECURITY.md`](SECURITY.md): how to run the security audit
- [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md): how the features map to GovS-013, ECCTA and GDPR
- [`infra/LAUNCH.md`](infra/LAUNCH.md): the launch runbook
