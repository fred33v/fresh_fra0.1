# Provider application evidence documents

An applicant can attach supporting documents to their provider application (identity, company registration, qualification, insurance, training demonstration material or other). Recruitment reviewers open each document and record a decision. This builds on the candidate port (PR 95): it adds one table and one route file and changes no existing route, financial rule or review policy.

## What an applicant can do

- Add up to **10** documents per application: PDF, PNG or JPEG, **8 bytes to 512 KiB** each, with a document type (`identity`, `company_registration`, `qualification`, `insurance`, `training_demonstration`, `other`).
- Add documents only while the application is **submitted or declined**, the same window in which they can amend it. Amending keeps every document, and each document records the application revision it was added to.
- See their own documents with the status (awaiting review, verified, not accepted) and, for a rejection, the reviewer's reason. They never see which staff member decided.
- Download their own files at any time.

## What a reviewer can do

Reviewers are current administrators of the operator organisation (`PROVIDER_REVIEW_ORGANISATION_ID`), under the same authority and privileged-session (MFA) rules as the rest of the review queue.

- List an application's documents, including the upload revision, uploader and SHA-256.
- Download a file. **Every reviewer download is recorded** (`document.downloaded`).
- Decide a pending document once: **verified** (reason optional) or **rejected** (a reason of 10 to 500 characters, shown to the applicant). A decision is final; a mistaken upload is answered with a new upload.
- Nobody can decide evidence on their own application.

## Routes

| Route | Who | Purpose |
| --- | --- | --- |
| `POST /api/v1/provider-applications/me/documents` | applicant | multipart `file` and `kind`; 20 uploads per minute |
| `GET /me/documents` | applicant | own documents |
| `GET /me/documents/:docId/file` | applicant | own file |
| `GET /:id/documents` | reviewer | an application's documents |
| `GET /:id/documents/:docId/file` | reviewer | file (audited) |
| `POST /:id/documents/:docId/decision` | reviewer | `{ "status": "verified" \| "rejected", "reason": "…" }` |

## Safeguards

- **The file type comes from the file's own signature** (`%PDF-`, the PNG header, the JPEG marker), not from the browser's Content-Type or the file name. A web page, executable or archive renamed `passport.pdf` is refused.
- Files are served only as **attachments** with `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`, so a stored file is never displayed inside the application's own origin.
- Stored in PostgreSQL, like service-delivery evidence. The database enforces the size bounds, the allowed types, that the SHA-256 matches the bytes, and that a decision is complete (a rejection always has a reason).
- **Retained, not editable.** A trigger refuses any change to the stored file, name, type, hash, uploader or upload time, refuses a second decision, and refuses delete and truncate. The foreign key to the application is `RESTRICT`, so an application with evidence cannot be deleted.
- The per-application limit is enforced under a lock on the application row, so simultaneous uploads cannot exceed it (a test fires fourteen at once and expects exactly ten).
- Upload, decision and reviewer download are recorded in `provider_recruitment_audit` with the document id, type and hash, never the file.

## Limits you should know about

- **No malware scanning.** Files are checked by signature and size only, and are handed to reviewers as downloads. Reviewers should open them on a managed device. Scanning or quarantine would need a scanner and object storage, which this change does not add.
- **"Verified" is a reviewer's decision, not an identity check.** It records that a named reviewer looked at the document and accepted it. It does not establish identity through a trusted service.
- **Approval requires verified evidence.** A provider cannot be approved (or re-approved after suspension) unless at least one document on the application has been verified by a reviewer. Pending and rejected documents do not count, and a verified document stays on record across amendments. This is checked inside `reviewProvider`, after the status checks and before the signed-agreement check, and is refused with `400 Verify at least one evidence document before approving`. The rule is deliberately the plain one the owner chose: any one verified document, of any type. Requiring a specific type (say, an identity document for everyone and a registration document for companies) would be a small tightening of the same query.
- 512 KiB suits scans and photos at reasonable resolution. Larger files would need object storage with the existing S3 configuration.
- Not covered: a public (signed-out) application page. Applicants still need a verified account.

## Activation

Apply migration `048_provider_application_documents.sql`. No new setting is needed. The integration script is `scripts/provider-documents-integration.mjs` and runs in the Database CI job.
