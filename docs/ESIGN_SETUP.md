# Internal electronic signing — implementation and activation

This replaces the OpenSign provider plan with the requested internal Hono/PostgreSQL service. It provides an electronic signing record and a platform PDF seal. Email OTP and a platform certificate do **not** establish an advanced or qualified eIDAS signer identity. A self-signed development seal verifies cryptographic integrity but PDF readers will warn that its issuer is untrusted.

## Files and routes

The repository already has migrations 001–035, so the forward-only migration is `apps/fra-backend/backend/migrations/036_esign.sql`, rather than a second migration 001. The implementation lives in `src/esign/{routes,crypto,audit,certificate,finalise}.ts` under that backend.

All manager routes below are under `/api/v1/esign`. They require a current manager account in the document's organisation. Read-only API keys cannot use them. The feature requires PostgreSQL and `ESIGN_ENABLED=true`.

| Step             | Method and path                                | Payload / behaviour                                                                                                                                            |
| ---------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload           | `POST /documents`                              | Multipart `title`, `file` (PDF); returns document ID, prepared source hash and page dimensions                                                                 |
| Add signer       | `POST /documents/:id/signers`                  | JSON `{ "name": "Jane Doe", "email": "jane@example.test" }`; at most 20 signers                                                                                |
| Place fields     | `PUT /documents/:id/fields`                    | JSON `fields` array; each has `signerId`, zero-based `page`, `x`, `y`, `width`, `height`, `kind` (`signature`, `name`, `date`)                                 |
| Send             | `POST /documents/:id/send`                     | Freezes content/identities/layout; validates email, certificate and Object Lock setup; sends one invitation per signer and reports individual delivery results |
| Inspect          | `GET /documents/:id`                           | Metadata, signer statuses and fields; no secret digests                                                                                                        |
| Review source    | `GET /documents/:id/source`                    | Exact prepared PDF the signers review                                                                                                                          |
| Retry invitation | `POST /documents/:id/signers/:signerId/resend` | Replaces an unsatisfied signer's link and verification session; invalidates the old link; rate limited                                                         |
| Retry sealing    | `POST /documents/:id/finalise`                 | Safe after a storage/seal failure; requires every signer to have signed                                                                                        |
| Audit            | `GET /documents/:id/audit`                     | Verifies chain and head; after completion also checks the pinned S3 evidence checkpoint                                                                        |
| Final PDF        | `GET /documents/:id/final`                     | Reads the recorded S3 version and checks SHA-256                                                                                                               |
| Evidence         | `GET /documents/:id/evidence`                  | Downloads the retained JSON evidence manifest with signer decisions and the audit chain                                                                        |

Coordinates are PDF points from the **top-left** of the prepared page. Every signer must have at least one signature field. This implementation supports typed signatures using printable Latin text, not drawn signature images. It provides the sender's API and a plain HTML signer interface, not a new dashboard document-design page.

The upload limit is 5 MB at the route, further bounded by the existing global `MAX_BODY_BYTES` (1 MB by default, including multipart overhead). PDFs must have 1–100 pages. Preparation flattens form fields and rebuilds page content without document scripts, annotations or actions. The signer reviews this prepared copy; the upload's original SHA-256 and the prepared copy's SHA-256 are recorded in the audit. The original uploaded binary is also retained separately in PostgreSQL and, on completion, as an Object Lock-protected S3 version. Do not use this flow to preserve a previously signed PDF's existing signature validity.

## Signer journey

The emailed link opens `/api/v1/esign/sign/:token`. Tokens have 256 bits of randomness and only digests are stored. Links and document signing expire after seven days. The signer requests a six-digit code sent to the invited email address, with ten-minute expiry, one use and at most five guesses. Requests are limited per IP and per invitation; managers can resend after an invitation is exhausted. Successful verification creates a 30-minute HttpOnly, SameSite=Strict session cookie (Secure in production).

Only a verified signer may download the prepared document or submit a decision. Signing requires the explicit consent checkbox, typed signature and matching prepared-source hash. Declining requires verification and blocks completion for the whole document. Repeated/concurrent decisions are refused. Browser forms use session-bound anti-forgery tokens when the no-referrer policy produces an opaque Origin; foreign origins are rejected.

After the last signature, the service renders the fields and a completion-record page, applies a detached SHA-256 CMS PDF seal using the configured RSA P12 certificate, and stores the original upload, prepared source PDF, sealed PDF and evidence manifest. It records exact S3 version IDs and checksums. A seal/storage failure preserves the already committed signer decision and returns a pending result; the manager can retry finalisation without asking people to sign again. Concurrent successful retries reuse the completed record. Partial failed attempts can leave retained objects; they are not deleted automatically.

The sender can download the completed PDF/evidence and provide copies to signers. Automatic completion emails and a long-term signer-download portal are not implemented.

## Audit and retention boundaries

Database triggers serialize appends per document, allocate sequence numbers, and hash each canonical entry with its predecessor. Update/delete/truncate of the journal are rejected. Verification checks both the chain and document head, including the canonical entry's actual columns. Completed chains are checkpointed in an S3 Object Lock manifest, and the audit route compares that checkpoint with the live chain. New evidence tables have no cascading foreign keys to users, organisations or existing retention targets, and no automatic purge rule.

A hash chain is tamper-evident, not a defence against every database administrator: owners/superusers can disable triggers or rebuild a pre-completion chain. Use a separate non-owner runtime database role, without DDL/trigger-disabling privileges; grant SELECT/INSERT on `esign_audit`, never UPDATE/DELETE/TRUNCATE. Give migration ownership to a separate deployment role. Maintain independent backups and protect the retained manifest references.

## Activation, step by step

Do these in a development environment first. The owner currently has neither the certificate nor an Object Lock bucket. No production migration, bucket creation or real signing has been performed by this implementation.

### 1. Create a development seal

On your machine, from `apps/fra-backend/backend`, run:

```bash
bash scripts/esign-create-test-seal.sh "$PWD/.local/esign"
```

OpenSSL asks for an export password. Save it in your password manager. Keep `seal-test.p12` private and do not upload it to GitHub or chat. The script refuses to overwrite existing files and removes the temporary unencrypted private key. The generated certificate is explicitly for development. For a production seal trusted by PDF readers, obtain and validate a suitable organisation signing certificate and chain before switching certificates.

### 2. Create a dedicated S3 evidence bucket

In AWS S3, create a **new private bucket** in your chosen region, separate from the app's ordinary `S3_BUCKET`. Enable **versioning** and **Object Lock**. Keep public access blocked. Do not configure lifecycle expiration or automatic deletion for this bucket. Do not expose its keys through the existing generic upload/download routes.

Use an application IAM role, with bucket reads `s3:GetBucketVersioning`, `s3:GetBucketObjectLockConfiguration`, and object permissions `s3:PutObject`, `s3:PutObjectRetention`, `s3:PutObjectLegalHold`, `s3:GetObjectRetention`, `s3:GetObjectLegalHold`, `s3:GetObjectVersion`. Limit object resources to `esign/*`. Keep bucket-policy/administrative permissions out of this role. Add appropriate policy constraints against object/version deletion, retention reduction and clearing legal holds; check the effective AWS policy before activation.

Each write requests SSE-S3 encryption, SHA-256 checksum, conditional creation, **COMPLIANCE retention** and legal hold **ON**, then reads back the returned version's protection. The default compliance period is 3,650 days (`ESIGN_RETENTION_DAYS`, allowed 365–36,500). Legal holds do not expire automatically. A compliance-locked version cannot be replaced or deleted during that period; after it ends, a sufficiently privileged operator can release a legal hold. These controls do not make the document eternally indestructible or prevent someone editing a downloaded copy (the PDF seal then fails validation).

### 3. Configure server-side secrets

```dotenv
ESIGN_ENABLED=false
ESIGN_PUBLIC_URL=https://your-api.example.com
ESIGN_OTP_SECRET=<at-least-32-random-characters>
ESIGN_P12_PATH=/run/secrets/esign-seal.p12
ESIGN_P12_PASSPHRASE=<private-password>
ESIGN_S3_BUCKET=<dedicated-private-object-lock-bucket>
AWS_REGION=<bucket-region>
ESIGN_RETENTION_DAYS=3650
```

Use a secret manager and an IAM role; do not hard-code AWS credentials. Configure the existing SMTP settings, including authenticated TLS and `EMAIL_FROM`. `ESIGN_PUBLIC_URL` is the HTTPS **origin serving these Hono routes**, without a path, query or credentials. Both Nginx configurations in this repository disable access/error request logging for `/api/v1/esign/sign/` and retain the no-referrer policy. Apply the updated configuration and verify any ALB/CDN/WAF logs also omit bearer URLs; do not add analytics to signer pages. Limit access to plaintext OTPs to the email recipient; the server stores HMAC digests.

### 4. Migrate and test before enabling production

From the backend directory, run `npm run esign:check` for a read-only certificate/configuration/Object Lock readiness check. It creates no document, object or email. Apply migration 036 to an isolated PostgreSQL database first. Run the integration checks below and then a real SMTP/S3 test with your development certificate and synthetic documents. Verify the recorded S3 object versions, COMPLIANCE retention, legal holds and refusal of version deletion under the intended IAM role. Confirm PDF signature verification against the intended certificate chain. Only enable `ESIGN_ENABLED=true` on the target environment after these checks and review.

## Validation

```bash
# Backend build and unit tests
npm run build
npm test -- --runInBand

# Requires a migrated disposable loopback PostgreSQL database, never production:
ESIGN_TEST_DATABASE=1 node --import tsx scripts/esign-integration.mjs

# Add a real Chromium signer journey (Playwright Chromium must be installed):
ESIGN_TEST_DATABASE=1 ESIGN_BROWSER_TEST=1 node --import tsx scripts/esign-integration.mjs
```

The SQL integration tests use captured email and a storage double, but real PostgreSQL, PDF rendering, generated RSA certificates and OpenSSL CMS verification. The browser option uses real Chromium and real Hono HTTP forms through code verification, PDF review, consent and signing. Unit tests check the AWS SDK Object Lock requests and fail-closed confirmation logic. These checks do **not** prove an actual AWS bucket/IAM configuration or real SMTP delivery. Local attempts to run a MinIO storage test were blocked by container-registry access; no live S3 test is claimed.

## Recorded local result (2026-11-16)

- Root `npm run build`: **5 successful tasks** (23.319 seconds on the final implementation build).
- Backend Jest: **59 suites, 754 tests passed** (231.825 seconds). The compliance load fixture now seeds authenticated persisted users/organisations and real JWTs instead of timing password-hash setup; endpoint concurrency and latency limits are unchanged. Earlier local timeout failures were resolved; the separate authentication flows remain tested.
- Root security regressions: **26 passed**.
- All **36 migrations** applied to a fresh disposable PostgreSQL 17 database, followed by **8 signing scenarios**, including real Chromium and OpenSSL verification of the PDF CMS seal. The browser test includes a Latin-accented typed signature, and tests reject CSRF, expired codes/links, replay, refused consent and tampering; resend rotates the invitation.
- Backend ESLint: **zero errors**, five existing warnings outside the new module. Shell scripts pass `bash -n`.
- `esign:check` correctly reports NOT READY in this unconfigured environment. The actual S3 bucket/IAM protection, real SMTP delivery, deployed proxy configuration and a production seal certificate remain activation gates. No production migration or deployment occurred.
