# SECURITY.md — Full Security Audit Guide (Stop FRA monorepo)

> **How to use this file**
> Open Claude Code in the project root folder and type:
>
> ```
> Read SECURITY.md and run the full security audit it describes.
> ```
>
> Claude will check the whole repository against the checklist below and write the
> results to `SECURITY_REPORT.md`. Run it again after fixing issues, before every
> release, and after adding any new feature that touches login, payments, uploads
> or personal data.

---

## 0. Rules for the auditor (Claude must follow these)

1. **Read-only first.** Do not change any code during the audit. Only create
   `SECURITY_REPORT.md`. Fixes happen afterwards, one at a time, when the owner asks.
2. **Never print secret values.** If a key, password, token or connection string is
   found, report the file and line and the *type* of secret (e.g. "Stripe live key"),
   but mask the value (`sk_live_****`). Never paste it into the report, a commit,
   an issue or any web service.
3. **Do not run anything that touches real systems.** No deploy scripts
   (`infra/scripts/*`), no `terraform apply`, no database migrations against
   production, no real Stripe calls, no emails. Reading these files is fine.
4. **Safe commands only.** Allowed: reading files, `grep`/search, `git log`,
   `git ls-files`, `pnpm audit`, `pnpm outdated`, `pnpm -r typecheck`, `pnpm lint`,
   running the existing unit tests. Ask before installing any new tool.
5. **Explain for a novice.** Every finding must say, in plain English, *what the
   problem is*, *why it matters*, and *exactly how to fix it* (file + suggested change).
6. **Prove it.** Each finding must cite `path/to/file.ts:line`. If you are unsure,
   mark it **"Needs manual check"** instead of guessing.

---

## 1. What this project contains (scope)

| Area | Path | Tech | Main risks |
|---|---|---|---|
| Backend API | `apps/fra-backend/backend/` | Node, Hono, PostgreSQL (`pg`), JWT, Stripe, S3, Upstash Redis, SMTP | Auth, access control, SQL injection, payments, uploads, personal data |
| Web dashboard | `apps/fra-web-dashboard/` | React 19, Vite, Zod | XSS, token storage, exposed env vars |
| Mobile app | `apps/fra-mobile-app/` | Expo 54, React Native | Token storage, secrets in bundle, deep links |
| Training (e-learning) app | `apps/fra-training-app/` | Expo 54, React Native | Same as mobile + progress/score tampering |
| Budget guide app | `apps/fra-budget-guide/` | Expo 54, React Native | Same as mobile |
| Shared packages | `packages/` | TypeScript | Shared validation/auth helpers |
| Infrastructure | `infra/` (Terraform, nginx, systemd, scripts) | AWS EC2, S3, SSM | Open ports, public buckets, TLS, IAM |
| CI/CD | `.github/workflows/ci.yml`, `.husky/` | GitHub Actions | Leaked secrets, unsafe workflow triggers |
| Git history | `.git` | — | Secrets committed in the past |

Sensitive features to give **extra attention**: `speak-up*.ts` (whistleblowing —
reporter anonymity is critical), `stripe.ts` + webhooks, `s3.ts` uploads,
`evidence-pack.ts` / `zip.ts` / `pdf-generator.ts`, `retention.ts`, `auth-utils.ts`,
`middleware.ts`, `entitlements.ts`, `webhooks-out.ts`, `csv.ts`.

---

## 2. Audit checklist

Work through every section. For each item record: ✅ Pass, ❌ Fail, ⚠️ Partial, or
❓ Needs manual check.

### 2.1 Secrets & Git hygiene

- [ ] No real secrets in tracked files: search for `sk_live_`, `sk_test_`, `whsec_`,
      `AKIA`, `-----BEGIN`, `postgres://`, `postgresql://`, `JWT_SECRET=`,
      `SMTP_PASS=`, `UPSTASH_REDIS_REST_TOKEN=`, `password`, `apiKey`, `secret`.
- [ ] `git ls-files` shows no `.env`, `.pem`, `.key`, `.p8`, `.p12`, `.jks`,
      `*.tfstate`, `terraform.tfvars` files (only `*.example` files).
- [ ] **Git history** is clean: `git log -p --all -S 'sk_live_'` (repeat for the other
      patterns above). A secret that was ever committed must be treated as leaked and
      **rotated**, even if it was deleted later.
- [ ] `.env.example` files contain only placeholders, never real values.
- [ ] `.gitignore` covers env files, keys, Terraform state, Expo credentials
      (currently looks good — confirm nothing slipped through).
- [ ] `.claude/launch.json`, `.DS_Store`, `.turbo/` and report files are not leaking
      paths or tokens.
- [ ] GitHub repo settings (manual check by owner): secret scanning + push protection
      ON, Dependabot alerts ON, branch protection on `main`, 2FA on the GitHub account.

### 2.2 Authentication (backend `auth-utils.ts`, `middleware.ts`, `routes/`)

- [ ] Passwords hashed with bcrypt (cost ≥ 12) or Argon2id — never plain, MD5, SHA1/256.
- [ ] Minimum password length ≥ 12 (or 8 + breached-password check).
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are **required and different** in
      production; server refuses to start with missing/short secrets (≥ 32 random bytes).
- [ ] JWT verify pins the algorithm (e.g. `algorithms: ['HS256']`), rejects `none`,
      checks `exp`; access token ≤ 30 min.
- [ ] Refresh tokens are rotated on use, stored hashed server-side, and revoked on
      logout and password change.
- [ ] Login, register, forgot-password and reset-password are rate-limited
      (per IP **and** per account) and return identical messages for
      "user not found" vs "wrong password".
- [ ] Password reset tokens: random (≥ 32 bytes), stored hashed, single-use,
      expire ≤ 1 hour, link uses `WEB_APP_URL` (not the request `Host` header).
- [ ] Account lockout / slowdown after repeated failures.
- [ ] MFA available at least for admin users (note if missing).

### 2.3 Authorization / access control (most common real-world bug)

- [ ] **Every** route in `routes/` has an auth check unless it is intentionally public
      (list the public ones in the report).
- [ ] **IDOR check:** every query that loads an assessment, report, evidence pack,
      workshop, budget guide, speak-up case, file or invoice by ID also filters by the
      current user's organisation/tenant (`WHERE id = $1 AND org_id = $2`).
- [ ] Roles (admin / manager / user, etc.) are checked on the server, never only hidden
      in the UI.
- [ ] `entitlements.ts`: paid features cannot be unlocked by editing the request,
      local storage or the mobile app — server checks the subscription/payment.
- [ ] Training app: course completion, quiz scores and certificates are calculated or
      validated server-side (a user cannot POST "score: 100").
- [ ] Users cannot change their own role, organisation or plan via profile-update
      endpoints (mass assignment).

### 2.4 Input validation & injection

- [ ] All SQL uses parameters (`$1, $2`) — search for template strings inside
      `query(` / `pool.query(` and string concatenation building SQL.
- [ ] Every request body/query/param is validated with Zod before use.
- [ ] `MAX_BODY_BYTES` enforced; JSON parse errors handled.
- [ ] `csv.ts`: CSV/formula injection — cells starting with `= + - @` are escaped
      when exporting.
- [ ] `pdf-generator.ts` / `zip.ts` / `evidence-pack.ts`: user text is escaped; file
      names inside ZIPs cannot contain `../` (zip-slip); no shell commands built from
      user input (`child_process`, `exec`).
- [ ] `webhooks-out.ts`: outgoing webhook URLs supplied by users are checked against
      SSRF (block `localhost`, `127.0.0.0/8`, `169.254.169.254`, private IP ranges,
      non-https).
- [ ] No `eval`, `new Function`, or dynamic `require` with user input.
- [ ] Web dashboard: no `dangerouslySetInnerHTML` with user content (or it is
      sanitised with DOMPurify); no `javascript:` links from user data.

### 2.5 Payments (Stripe) — `stripe.ts`, webhook route

- [ ] Webhook verifies the signature with `STRIPE_WEBHOOK_SECRET` using the **raw**
      request body; rejects unsigned/invalid events.
- [ ] Webhook processing is idempotent (same event ID twice doesn't grant twice).
- [ ] Prices/amounts come from the server or Stripe price IDs, never from the client.
- [ ] Access is granted only after `checkout.session.completed` /
      `async_payment_succeeded`, not on the redirect "success" page.
- [ ] Production refuses `sk_test_` keys and simulated payments are impossible when
      `NODE_ENV=production`.
- [ ] No card data ever touches this server (Stripe Checkout only).

### 2.6 File uploads & storage — `s3.ts`

- [ ] Bucket is private; Block Public Access ON (check `infra/terraform/main.tf`).
- [ ] Pre-signed URLs are short-lived (≤ 5 min) and only issued after an
      authorization check for that specific file.
- [ ] Upload size limit and MIME allow-list enforced **server-side**; object keys are
      generated by the server (no user-controlled paths).
- [ ] Bucket encryption at rest (SSE-S3 or SSE-KMS) and versioning enabled.
- [ ] Downloads served with `Content-Disposition: attachment` for untrusted types.

### 2.7 Personal data & UK GDPR (fraud / whistleblowing context)

- [ ] **Speak-up module:** anonymous reports do not store IP address, user agent,
      user ID or email unless the reporter opts in; logs do not reveal reporter identity;
      only authorised investigators can read cases.
- [ ] Logs (`logger.ts`) never contain passwords, tokens, full JWTs, reset links,
      card data, or personal data beyond what is necessary.
- [ ] `retention.ts`: data deletion rules exist and actually run; user data export
      and deletion requests are possible.
- [ ] Database connections use TLS in production; backups (`backup-database.sh`)
      are encrypted and access-restricted.
- [ ] Error responses never return stack traces or SQL errors in production.
- [ ] Emails (`email.ts`) use TLS; `SMTP_REQUIRE_TLS=false` impossible in production.

### 2.8 API & HTTP hardening — `index.ts`, `middleware.ts`, `infra/nginx/`

- [ ] CORS: production allows only `CORS_ORIGINS` list, no `*` with credentials.
- [ ] Security headers set (backend or nginx): `Strict-Transport-Security`,
      `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` /
      `frame-ancestors`, `Referrer-Policy`, a `Content-Security-Policy` for the
      dashboard.
- [ ] Rate limiting backed by Redis (works across restarts/instances), not only
      in-memory.
- [ ] nginx: TLS 1.2+ only, HTTP → HTTPS redirect, `server_tokens off`,
      sensible `client_max_body_size`, proxy passes real client IP safely.
- [ ] Backend binds to `127.0.0.1` in production (behind nginx).
- [ ] Health/debug endpoints don't expose versions, env vars or internals.

### 2.9 Web dashboard — `apps/fra-web-dashboard/`

- [ ] Only non-secret values use the `VITE_` prefix (everything with `VITE_` is
      public in the browser bundle).
- [ ] Where tokens are stored: prefer httpOnly, Secure, SameSite cookies; if
      `localStorage` is used, note the XSS risk and confirm strong CSP.
- [ ] Logout clears all tokens and cached user data.
- [ ] Source maps not published in production builds (or not publicly reachable).
- [ ] Routes protected client-side **and** API enforces it (see 2.3).

### 2.10 Mobile apps — `fra-mobile-app`, `fra-training-app`, `fra-budget-guide`

- [ ] **Tokens stored in `expo-secure-store`** (Keychain/Keystore), **not**
      `@react-native-async-storage/async-storage` (AsyncStorage is unencrypted).
      Search for `AsyncStorage.setItem` with token/auth/user keys.
- [ ] No secrets in `EXPO_PUBLIC_*` variables, `app.json`, or source — everything in
      the app bundle can be extracted.
- [ ] API base URL is `https://` in production; no `http://` or `usesCleartextTraffic`
      / `NSAllowsArbitraryLoads` in release builds.
- [ ] Deep links / `scheme` in `app.json`: incoming links are validated; no
      auth tokens passed in URLs.
- [ ] Android permissions in `app.json` are only what's needed.
- [ ] Debug logging (`console.log` of tokens/responses) removed or disabled in release.
- [ ] Offline-cached e-learning content and user progress don't include other users'
      data.

### 2.11 Dependencies & supply chain

- [ ] Run `pnpm audit --prod` and list **critical/high** issues with the fix version.
- [ ] Run `pnpm outdated -r` and flag packages more than one major version behind
      that are security-relevant (hono, jsonwebtoken, pg, stripe, expo, react, vite).
- [ ] `pnpm-lock.yaml` is committed and CI installs with `--frozen-lockfile`.
- [ ] No abandoned or typo-squatted packages (unexpected names, very low downloads).
- [ ] `.npmrc` doesn't contain auth tokens.

### 2.12 CI/CD — `.github/workflows/ci.yml`, `.husky/`

- [ ] Workflow has `permissions:` set to the minimum (e.g. `contents: read`).
- [ ] No `pull_request_target` running untrusted code with secrets.
- [ ] Third-party actions pinned to a version tag or commit SHA.
- [ ] Secrets only via GitHub Secrets; never echoed in logs.
- [ ] CI runs lint, typecheck, tests and `pnpm audit` (suggest adding if missing).
- [ ] Suggest adding a secret scanner (e.g. gitleaks) to the pre-commit hook / CI.

### 2.13 Infrastructure — `infra/terraform`, `infra/scripts`, `infra/systemd`

- [ ] Security groups: SSH (22) not open to `0.0.0.0/0` (prefer SSM Session
      Manager); Postgres (5432) never public; only 80/443 public.
- [ ] EC2 uses IMDSv2 (`http_tokens = "required"`), encrypted EBS volumes.
- [ ] IAM roles follow least privilege (no `"Action": "*"` / `"Resource": "*"`).
- [ ] Secrets come from SSM Parameter Store (SecureString), not hard-coded in
      `ec2-user-data.sh` or scripts.
- [ ] Terraform state stored remotely and encrypted (S3 + DynamoDB lock), not in git.
- [ ] systemd service runs as a non-root user with hardening options
      (`NoNewPrivileges=true`, `ProtectSystem=strict`, `PrivateTmp=true`).
- [ ] Scripts use `set -euo pipefail` and don't print secrets.

### 2.14 Automated checks to run (safe)

```bash
pnpm audit --prod
pnpm -r typecheck
pnpm lint
pnpm test:backend
git ls-files | grep -Ei '\.env$|\.pem$|\.key$|\.p8$|\.p12$|tfstate|tfvars$'
```

Record the output summary (not full logs) in the report.

---

## 3. Severity scale

| Level | Meaning | Example | Fix by |
|---|---|---|---|
| 🔴 **Critical** | Attacker can take over accounts, read other customers' data, or get money/paid access free | Live secret in git, IDOR on reports, unsigned Stripe webhook | Before next deploy |
| 🟠 **High** | Serious weakness, needs some conditions | No login rate limit, tokens in AsyncStorage, public S3 | This week |
| 🟡 **Medium** | Defence-in-depth gap | Missing CSP, long token lifetime | This month |
| 🟢 **Low** | Best practice / hygiene | Outdated non-critical package, verbose logs | When convenient |
| ℹ️ **Info** | Good practice observed, or note | "Passwords use bcrypt cost 12 ✅" | — |

---

## 4. Report format (`SECURITY_REPORT.md`)

Claude must write the report in this structure:

```markdown
# Security Report — <date>

## Summary (plain English, 5 lines max)
Overall risk: <Low / Medium / High / Critical>
Counts: 🔴 x · 🟠 x · 🟡 x · 🟢 x

## Top 5 things to fix first
1. ...

## Findings
### [🔴 CRITICAL] <short title>
- **Where:** `apps/fra-backend/backend/src/routes/x.ts:42`
- **What's wrong:** <one or two sentences a beginner understands>
- **Why it matters:** <what an attacker could do>
- **How to fix:** <step-by-step, with a small code example>
- **Effort:** <5 min / 1 hour / 1 day>

## Checklist results
<table of every item in section 2 with ✅ ❌ ⚠️ ❓>

## Things the owner must check manually
<GitHub settings, AWS console, Stripe dashboard, App Store / Play settings>

## Secrets to rotate (if any)
<type + location only, masked — never the value>
```

---

## 5. After the audit — fixing safely

1. Fix **one finding at a time**, on its own git branch, starting with 🔴 Critical.
2. Ask Claude: *"Fix finding #1 from SECURITY_REPORT.md and add a test for it."*
3. Run `pnpm test` and `pnpm typecheck` after each fix.
4. If a secret leaked: **rotate it first** (Stripe dashboard, AWS IAM, database
   password, JWT secret), *then* remove it from the code. Removing it from git alone
   is not enough.
5. Re-run this audit after fixes and before every production release.

---

## 6. Reporting a vulnerability

If you discover a security issue in Stop FRA, please **do not open a public GitHub
issue**. Email the maintainers privately (add your security contact address here)
with a description and steps to reproduce. We aim to acknowledge reports within
3 working days.
