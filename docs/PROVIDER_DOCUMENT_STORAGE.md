# Provider evidence documents: S3 storage and virus scanning

Builds on `docs/PROVIDER_EVIDENCE_DOCUMENTS.md`. Evidence documents (identity, company registration, qualifications)
can now be kept in S3 instead of the database, with larger files, and can be virus-scanned. **Both are off by default**:
with no new settings the system behaves exactly as before (database, 512 KiB, no scanning).

## What changed

| | Before | Now |
|---|---|---|
| Where bytes live | `content` column only | Per row: the `content` column, or an S3 object (`storage`, `storage_key`) |
| Size limit | 512 KiB | 512 KiB in the database; up to 10 MiB in S3 (`PROVIDER_DOCUMENT_MAX_BYTES` can lower it) |
| Virus scan | none | Optional ClamAV (`clamd`); fail closed |
| Reading a file | row | Row or S3; an S3 file is accepted only if its size and SHA-256 still match the row |

Migration `049` adds `storage`, `storage_key`, `size_bytes`, `scan_status`, `scanned_at` and `scan_engine`. Existing rows
keep their bytes in the database (backfilled `storage='database'`, `scan_status='not_scanned'`); **no file is moved or
rewritten**. A file never moves between places.

## Settings (all in `apps/fra-backend/.env.example`)

- `PROVIDER_DOCUMENT_STORE=database|s3` where **new** uploads go. Switching never strands existing files, because each row
  says where its file is. With `s3` and no S3 configured, uploads are refused (503); they never fall back to the database.
- `S3_BUCKET`, `S3_REGION` (existing) bucket and region. Optional: `PROVIDER_DOCUMENT_S3_PREFIX` (default
  `private/provider-documents`), `PROVIDER_DOCUMENT_MAX_BYTES`, `PROVIDER_DOCUMENT_KMS_KEY_ID`.
- `PROVIDER_DOCUMENT_SCAN=clamd`, `CLAMD_HOST`, `CLAMD_PORT` (3310), `CLAMD_TIMEOUT_MS` (20000).
- `PROVIDER_DOCUMENT_REQUIRE_SCAN=1` once scanning is on: a file that was never scanned cannot be **verified** (it can still be
  rejected). Without it, files uploaded before scanning was enabled can still be verified.

Startup refuses bad values (`PROVIDER_DOCUMENT_STORE=s3` without a bucket and region, `REQUIRE_SCAN` without a scanner) and warns
about S3 storage with no scanner.

## How an upload now works

1. The request is limited to the configured file size plus form overhead. Only `POST /provider-applications/me/documents`
   gets more than the 1 MB default, and only in S3 mode.
2. Cheap refusals first (wrong application state, ten files already): a refused upload costs no scan and no S3 write.
3. The file's own signature decides its type (PDF, PNG, JPEG) and its SHA-256 is computed.
4. If scanning is on, clamd must answer "clean". An infected file is **not stored** (its hash and the signature are audited as
   `document.rejected_by_scan`; the applicant sees a generic refusal). An unreachable or confused scanner refuses the upload (503).
5. In S3 mode the object is written by this server under an opaque key (`<prefix>/<document id>`: no file name, no personal
   data), encrypted at rest (KMS if configured, otherwise S3-managed keys), with S3 verifying the SHA-256 we computed.
6. The row is recorded under the application row lock (so the ten-file limit cannot be raced past). If recording fails, the
   object just written is deleted, so a lost race leaves no personal data behind.

Downloads go through the server, as attachments with `nosniff` and `no-store`; there are no presigned URLs. Reviewer downloads
are still audited. A changed, truncated or missing object is refused (500 / 503), never served.

## Not done, and limits you should know about

- **No real bucket or daemon was used in testing.** The S3 calls are checked against a stand-in client (the exact request
  parameters are asserted, including encryption and the SHA-256 checksum) and the scanner against a fake TCP daemon. Try both
  once against a real private bucket and a real clamd before relying on them.
- **Detection is clamd's.** CI proves the protocol (framing, verdicts, timeouts, fail-closed behaviour) against a stand-in
  daemon, not detection. Run clamd with fresh signatures (`freshclam`) and monitor it; this repository does not provision it.
- **Existing files are not scanned.** Documents uploaded before scanning was enabled stay `not_scanned` (reviewers see this).
  A re-scan job would have to read each file and write the verdict, which the retention triggers currently forbid by design.
- **No Object Lock / legal hold on these objects.** The e-sign store uses COMPLIANCE-mode retention, which would make identity
  documents impossible to erase on a lawful request. Retention and erasure of identity documents is a policy decision still
  to be made; until then, enable bucket versioning and a lifecycle rule that matches that decision.
- **The bucket must be private** and its access limited to this service. The application never makes objects public, but it
  cannot enforce bucket policy.
- **Uploads pass through the server** (memory up to 10 MiB per request, 20 uploads a minute per address). Larger files or
  higher volume would need direct-to-S3 uploads with a post-upload scan, which is a different design.
- **Sizes and types** are unchanged apart from the limit: PDF, PNG or JPEG, 10 files per application.

## Tests

`scripts/provider-documents-storage-integration.mjs` (72 checks, runs in CI; in-memory object store and stand-in scanner with the
real routes and PostgreSQL): placement, opaque key, integrity on read, fail-closed scanning, orphan cleanup under 14 racing
uploads, mode switching, the scan requirement, and the database constraints. `__tests__/provider-document-scan.test.ts` (clamd
framing and verdicts against a fake TCP daemon), `provider-document-storage.test.ts` (S3 parameters, mode selection, request
size limit), `production-env.test.ts`, and dashboard component tests.
