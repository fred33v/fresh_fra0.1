# Stop FRA — compliance evidence and retention

Updated 2026-11-16. This document describes application controls and known limits. It does not certify an organisation's legal compliance. Earlier percentage scores and blanket implementation claims have been removed because they were not supported by an independent assessment.

## Evidence supported by the application

Organisation records include assessments and results, risk registers, training and certificates, incidents, senior-management records, counter-fraud records, speak-up cases, budget plans and audit events. Compliance calculations are derived from the organisation's stored evidence; a calculated status is not a legal determination of reasonable prevention procedures.

The Enterprise compliance API includes report, gap analysis, training, senior management, incidents, audit trail, export and evidence-pack routes under `/api/v1/compliance`. Access requires an eligible package and manager authority. The current persisted user role and organisation are checked, so an old JWT does not preserve access following demotion or an organisation transfer. Evidence responses use `Cache-Control: no-store`.

The organisation export and evidence pack cover defined datasets; they are not a complete GDPR subject-access or portability service. Coverage of newly introduced Phase 1 entities remains an acceptance item. Do not claim that all reads are audited, that row-level security protects every query, or that every entity implements soft deletion.

## Retention implementation

The source of truth is `apps/fra-backend/backend/src/retention.ts`. Its scheduler targets 02:00 UTC daily. Runs count eligible records by default. Permanent deletion is enabled only with `RETENTION_ENABLED=true`, or an explicit programmatic `runRetention({ dryRun: false })` call. There is no implemented one-year archive-table process.

The following are the existing configured application rules, not a statement that these periods are mandatory for every customer or jurisdiction:

| Record                | Existing eligibility rule                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Assessments           | Last update more than six years ago; the rule does not check active status                           |
| Audit logs            | Created more than six years ago                                                                      |
| Risk register         | Mitigated, accepted or closed, last updated more than six years ago                                  |
| Incidents             | Resolved more than six years ago                                                                     |
| Counter-fraud records | Certain loss, detection, hospitality or ended conflict records, last updated more than six years ago |
| Speak-up cases        | Closed more than six years ago; associated messages cascade with the case                            |
| Purchases             | Created more than seven years ago                                                                    |
| Key passes            | Expired more than two years ago                                                                      |
| Workshop feedback     | Created more than two years ago                                                                      |
| Refresh tokens        | Created more than 90 days ago                                                                        |

The owner has selected **preservation of all new Phase 1 data without automatic purge**, including the new professional/referral/signature features. See [the approved Phase 1 scope](PHASE_1_APPROVED_SCOPE.md). Certificate snapshots, payment event receipts, durable webhook deliveries and budget-plan history are not direct targets of the current retention rules. This alone does not prove full preservation: related source records, audit evidence and foreign-key effects need explicit verification. Production deletion is outside the current development work. Leave destructive retention disabled while that acceptance work is open.

Preservation does not implement an erasure-request process. Subject requests, legal holds, documented lawful bases, purpose restrictions, retention justification and decisions about exceptions require an operational owner. A general `deleted_at` mechanism, automatic DSAR endpoint and breach-notification workflow must not be claimed as completed.

## Certificates and external signatures

Existing verifiable certificate records retain an issuance snapshot and support revocation. Public verification exposes an allowlist of certificate fields; it does not establish an advanced or qualified electronic signature.

The owner requested an internal signing service in place of external providers. The [implementation](ESIGN_SETUP.md) records email verification, consent, typed signer decisions and a hash-chained audit log, then applies a platform CMS PDF seal and retains versioned S3 evidence with Object Lock. This does not establish advanced/qualified eIDAS signer identity. Feature activation requires the owner's seal certificate, SMTP and a dedicated Object Lock bucket; real infrastructure checks remain pending.

## Release evidence and remaining acceptance

Technical evidence belongs in the relevant Phase 1 change documents and CI results, tied to a commit. Local test results do not establish the deployed TLS/proxy configuration, database encryption at rest, production migration status, independent penetration testing, or legal compliance.

Before release, complete the expanded [Phase 1 scope](PHASE_1_APPROVED_SCOPE.md), verify organisation/subject visibility and preservation, validate the external services in isolated test environments, and record an operational owner for privacy requests and incident response. PR #78 remains a draft. No production migration, purge or deployment is implied by these documents.
