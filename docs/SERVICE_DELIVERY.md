# Service delivery, attendance and customer review

## Verified baseline and scope

Existing workshop enrolment (`session_participants`), course progress, server quiz/completion checks and #96 professional completion assessments remain in place. Joining a class was not an explicit attendance declaration. Main #86 had assignment acceptance/refusal and an operator “completed” closure, but no customer-bound delivery dossier, retained service evidence or customer acceptance/refusal/dispute workflow.

Migration **045** adds that missing workflow for the **existing authorised training assignments/classes**. It does not invent a general professional-services catalogue, regulatory accreditation, employment scheduling/payroll, new commission ledger or service-fee payout system. Other professional service categories need their own implemented scope and assignment policy before they can use this model. No training or issuer rights are created by a delivery record.

## End-to-end workflow

1. Independently verify and approve the provider, subject/action grant and accepted scope-bound training assignment using the existing flows. The provider creates its authorised class in the professional console.
2. The operator opens the application on `/provider-review` → **Service delivery → Open deliveries**. Select the accepted class, look up verified customer contacts using the customer organisation reference, and designate its actual decision-maker. Record the title, schedule and reason. The customer must have a current verified `employer`/`admin` account in an independent organisation. The class must belong to this provider and assignment. An optional API purchase reference must match the customer organisation and package; a purchase reference is not proof of payment.
3. The trainer and designated customer use **User menu → Service delivery** (`/service-delivery`). Their list contains only their own deliveries, with 100-row pages. Operator mode rechecks current central reviewer authority on the server. Operators can also inspect the application-scoped panel. Merely sharing an organisation does not give another customer account the designated contact's decision rights.
4. Learners join the existing class normally. The trainer explicitly records `present`, `absent` or `excused` for enrolled learners belonging to this delivery's customer organisation. Corrections append revisions; they do not overwrite the original attendance. This is a trainer declaration, not independently measured physical attendance. The UI shows current learner course completion separately and retains attendance names if legacy class/progress data is later unavailable.
5. The trainer uploads retained PDF/PNG/JPEG evidence (maximum 512 KiB each, 10 per delivery) and writes the service completion/evidence summary. Submission requires at least one latest `present` declaration and one retained evidence file. It does not require every learner to pass: delivering a service and a learner satisfying certification criteria are different facts. Submission captures a manifest of exact file IDs/hashes and attendance revisions and freezes editing of the submitted evidence set.
6. The designated verified customer accepts or refuses the exact current delivery revision, with a reason. The provider cannot approve its own work; an operator cannot impersonate customer acceptance. Concurrent/stale decisions return a conflict. Customer acceptance here is an authenticated application decision, not a new qualified e-signature or signed employment agreement.
7. Refused work can be reopened by the currently authorised provider, corrected and resubmitted, with prior evidence and decisions retained. The provider or customer can raise a service dispute on submitted/accepted/refused work. An independent operator can return a dispute for rework or cancel the delivery; the customer can accept/refuse submitted or disputed work. Operators can also cancel uncompleted/refused planning with a reason. Cancellation is terminal. An operator resolving a dispute cannot substitute their own customer acceptance.
8. Closing a **scope-bound training assignment** as completed now requires at least one accepted delivery and no unfinished/refused/disputed non-cancelled delivery for that assignment. Cancelled history is retained and does not block accepted replacement work. The existing legacy/unscoped manual assignment closure remains supported. A later customer dispute records the current service dispute without silently rewriting the earlier assignment-closure event; operators see the delivery's current state and retained history.

## Evidence, access and history

Provider edits require current professional delivery authority, active supplier/provider identifiers and the original accepted/completed class assignment binding. A suspended professional can still read their retained business history and raise a historical service dispute, but cannot submit new delivery evidence or attendance under expired/suspended authority. Customer decisions about already submitted service remain possible even if the provider subsequently loses authority. Designated contact identity/organisation/current verified role is checked each time; contacts are not silently reassigned. If a contact or schedule is wrong, an independent operator can cancel unfinished work and create a correctly bound new record.

The server restricts every dossier, file and action to the provider, designated customer or current operator reviewer. Shared classes expose only the delivery customer's learner roster. Operator actor identifiers are excluded from non-reviewer detail/history responses. The history endpoint verifies the complete chain before returning a role-appropriate view; redacted views retain hash references but are server-verified, not independently recomputable from their redacted fields alone.

Evidence bytes and their SHA-256 digest are stored in PostgreSQL, not a newly provisioned bucket. Size/signature checks identify the accepted file formats; they are not a malware scan or verification that a document's claims are true. Downloads require authentication, recheck the digest, and use attachment disposition, `nosniff` and a restrictive CSP. The existing API body-size/CSRF/rate controls remain in force; the shared authenticated API client supports multipart uploads and its existing refresh behaviour. No public evidence URL or external fetch is introduced.

Database triggers retain files, attendance revisions, delivery bindings and hash-linked event snapshots. Each change increments the dossier revision and appends its event in the same transaction; audit failure rolls back the action. Histories preserve earlier submitted manifests, refusals, dispute reasons and resolutions. No automatic purge is introduced. This is database-enforced retention/tamper evidence, not S3 Object Lock or an independently anchored ledger against a database owner who can disable triggers and rewrite the complete chain. Legacy session/user deletion does not cascade into the new evidence tables.

## Financial and certificate boundaries

Service disputes are not Stripe chargebacks. These actions do not verify or collect a customer payment, issue a refund, send a payout, alter 17% referral commissions or create payroll/service-fee entries. Existing payment reconciliation and independent finance approval remain authoritative. A completed assignment or accepted service is not a bank confirmation. The unresolved “decision C” concerning commission basis in #98 is unchanged.

Legitimate learner course completion, professional completion assessment and certificate eligibility remain separate. A commercial dispute does not silently invalidate an actually completed learner's certificate or allow a provider/customer/operator to bypass learner eligibility. This independence is covered by the integration test, including certificate issuance during a service dispute.

## API and local verification

API base `/api/v1/service-delivery`:

- `GET /options` (operator application/class/customer-contact lookup).
- `GET /records` (own records or operator `view=review`, optional application filter/page), `POST /records` (operator creation).
- `GET /:id`, `GET /:id/history` (verified role-scoped history).
- `POST /:id/attendance`, `POST /:id/files` (multipart file + current revision), `GET /:id/files/:fileId`.
- `POST /:id/action` with current revision, reason and action `submit`, `reopen`, `accept`, `refuse`, `dispute`, `cancel`, `resolve_rework` or `resolve_cancel`; submission also requires the evidence summary.

Use normal forward migration after resolving any incompatible local PR94 schema via the existing guarded procedure. Tests require a disposable loopback database with `professional` in its name, non-production mode and all migrations through 045:

```sh
DELIVERY_TEST_DATABASE=1 node --import tsx scripts/service-delivery-integration.mjs
```

The test covers independent customer binding, shared-class tenant isolation, attendance/completion distinction and corrections, bounded evidence upload through the actual mounted API middleware, authenticated downloads, immutable submission manifests, provider/operator self-acceptance denial, refusal/rework/concurrent decisions, cancellation, disputes, scoped closure, legitimate learner certification during a service dispute, unchanged financial counts, retained/redacted verified history and audit-failure rollback. No external service, real customer email, live payment or production database is used.

Verified on 21 November 2026 against disposable PostgreSQL 17: fresh migrations through 045 and 4 grouped delivery integration scenarios; existing main recruitment/commission integration 98 checks and professional-authority integration 7 scenarios; 786 Web tests across 73 files; targeted delivery/API/recruitment/training UI 26/26 after final UI refinements; 122 targeted backend tests across 8 suites; backend/Web TypeScript and lint without errors (5 existing unrelated warnings per application); root build 5/5. The actual mounted API accepted the authenticated multipart test upload. No owner's Mac or production database was migrated.
