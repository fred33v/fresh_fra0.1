# Hire, Sell & Earn — development specification and implementation baseline

Owner specification received **21 November 2026** for Fresh FRA 0.1. This is the expanded target scope and acceptance checklist, **not a completion report**. Inspection baseline: checked-out commit `936588c3c80e9f167e7e83731467a8e986008e2c` on `feat/phase1-provider-recruitment`. Other remote branches and deployed environments are not certified by this inspection.

## Objective and confirmed boundaries

Extend the existing Web application and Hono/PostgreSQL backend with integrated recruitment, employee engagement, company supplier onboarding, package sales, service delivery, commission and payment management. Support individuals, employees, independent professionals and companies supplying through their own businesses.

This expands the earlier independent-services-only increment. Independent services without a guaranteed minimum remain one supported path; zero-hours employment, part-time employment, fixed-term employment and business-to-business supplier agreements are additional paths to build. A platform `employee` role, a company name, an application checkbox or a 17% commission does not establish employment/tax status. Existing retained applications and agreements must not be relabelled or converted retrospectively.

The commercial rate remains **17%**, applied to eligible **net collected package revenue**, excluding VAT, with unpaid/refunded/disputed amounts ineligible for release. This commission is distinct from agreed service fees and from salary/wages. Employee earnings must follow the applicable payroll route; independent/company supplier payments follow the supplier route. The module must not treat commission-only contractor payment as a substitute for employee payroll obligations.

Preserve existing functionality and migration history. Reuse the current account/organisation, recruitment, key-pass/entitlement, workshop, certificate, payment reconciliation, signing and audit infrastructure; do not create a parallel authentication, certificate or payment backend. New tables/routes may extend missing domain concepts, using forward-only migrations.

The owner's sequencing instruction remains: **Stripe integration and actual financial activation last**. No real charge, transfer, payroll run, subscription purchase, deployment or production purge is authorised by this specification update. Preserve newly introduced evidence without automatic purge, as previously requested. Retention and UK GDPR requirements need an explicit documented policy; indefinite evidence retention must not become an excuse to collect or retain unnecessary banking/identity data.

## Functional requirements supplied by the owner

### 1. Recruitment and applications

- Public application pages for individuals and companies.
- Applicant, company, contact and relevant professional information.
- Document uploads and verification.
- Review, approval, rejection and amendment workflows.

### 2. Trainer and professional onboarding

- Demonstrate ability to deliver training.
- Qualifications, experience and demonstration materials.
- Authorised review of approved training subjects and professional scopes.
- Connect approved professionals to the existing certification module.

### 3. Employment and supplier agreements

- Appropriate zero-hours, part-time and fixed-term employment agreements.
- Business-to-business supplier agreements.
- Appropriate independent contractor agreements.
- Electronic acceptance and signing.
- Contractual status, start date, expiry and termination.

### 4. Unique access codes

- Unique employee and supplier identifiers.
- Package-specific access permissions and secure assignment management.
- Employees can accept, refuse and manage assignments.
- Audit code creation, use, suspension and revocation.

### 5. Package sales

- Allocate products/packages to approved sellers and attribute sales to the correct seller.
- Calculate 17% of eligible net collected package revenue.
- Prevent commission release on unpaid, refunded or disputed transactions.
- Sales reports and commission statements.

### 6. Service delivery

- Assign approved trainers/professionals.
- Sessions, attendance and completion.
- Delivery evidence, customer acceptance/refusal/disputes and delivery history.

### 7. Financial management

- Secure payment-detail collection and verification; payroll distinct from business supplier payments.
- Reconcile customer collections; calculate commissions and agreed service fees.
- Finance approval before payout, unique confirmation references and provider references/amounts/dates/statuses.
- Refunds, chargebacks and commission adjustments.

### 8. Administration

- Manage applicants, employees, companies and suppliers.
- Approve/suspend professionals and sellers; assign package permissions.
- Approve commissions/supplier payments, report finance/activity, retain a tamper-evident audit trail.

### Security and compliance

- Role-based access, privileged-account MFA, encryption of financial/personal data and restricted banking access.
- Secure signing and payment verification through trusted provider events or bank reconciliation.
- UK GDPR and applicable employment, tax and payroll compliance.
- No self-approval of financial payouts; no unauthorised professional certification.

## Source inspection and reuse map

| Existing area inspected | Reuse | Boundary / missing work |
| --- | --- | --- |
| `src/routes/auth.ts`, `src/auth-utils.ts`, `src/providers/access.ts` | Current accounts, organisations, token sessions and persisted authority checks; appointed programme reviewers | No privileged-account MFA implementation found in these auth paths or numbered migrations. Signing email OTP is not administrator MFA. Business capabilities must not be inferred solely from platform role. |
| `src/providers/policy.ts`, `routes.ts`; migrations 040–041 (originally 037–038); Web `/partners` and `/partners/review` | Verified-account applications, immutable revisions, review/amendment/suspension, independent business declarations | `/partners` is protected by sign-in, not public application intake. One application per user is not a full company/representative model. General experience/expertise claims are not qualification verification or approval to teach a subject. |
| `src/routes/s3.ts` | Existing scoped upload/promotion/download infrastructure | General uploads are not a recruitment evidence registry, malware quarantine, file-verification decision or applicant-specific reviewer permission system. Keep applicant evidence separate from public assets and signed immutable PDFs. |
| `src/providers/agreements.ts`, `agreement-policy.ts`, `agreement-pdf.ts`; `src/esign/*` | Revision-bound independent agreement, two fixed signers, email OTP/consent, chained signing audit, PDF seal, protected final evidence and separate readiness review | Current fixed model is independent/no minimum. Employment/B2B template families, effective/start/end dates, expiry/termination administration and their rights/access effects are not implemented. Internal signing does not establish advanced/qualified signer identity. |
| `src/routes/keypasses.ts`, `src/db/keypasses.ts`, `src/entitlements.ts`; migrations 004/029 | Existing access codes, invitations, purchase-backed entitlements, quotas and redemption controls | Not a supplier/employee identity registry, seller package authorisation or assignment acceptance/refusal ledger. Reuse checks; identifiers must not become reusable bearer access secrets. |
| `src/workshop.ts`, `src/routes/team-training.ts`, migration 008 | Facilitator-led sessions, participants, progress/completion and employer training reporting | Not an end-to-end contracted service assignment, approved trainer scope, customer acceptance/refusal/dispute or supplier delivery evidence workflow. |
| `src/certificates.ts`, `src/routes/certificates.ts`; migrations 027/032 | Existing issuance policy, retained snapshots, public verification, controlled download/revocation | Training completion certificates and assessment certificates are not proof of an instructor's professional authority. Add explicit scoped reviewer decisions without inventing a new certificate issuer or granting automatic issuance rights. |
| `src/routes/payments.ts`, `src/payment-lifecycle.ts`, `src/stripe.ts`, migration 033 | Checkout and trusted provider-state reconciliation, refund/dispute handling and idempotent event receipts for purchases | Purchase reconciliation is not a seller commission ledger or verified outgoing payout. No Connect recipient onboarding, seller attribution, supplier payout approvals, payroll, payment confirmations or bank reconciliation module found in this audited branch. |
| `src/esign/audit.ts`, migrations 036–038; `src/retention.ts` | Hash-chained signing evidence, immutable recruitment/agreement/readiness records and existing audit hooks | This is not proof that every legacy activity is tamper-evident or that finance/delivery workflows exist. Extend evidence atomically to new activities; do not append to and invalidate a completed signing checkpoint. |

All source paths above are relative to `apps/fra-backend/backend/` unless explicitly marked Web. The Web routing evidence is `apps/fra-web-dashboard/src/App.tsx`. Existing production behaviour and CI on future commits require separate verification.

## Acceptance matrix — all 12 required before completion

**Partial** means reusable behaviour exists but the criterion is not complete end to end. No criterion below is accepted as completed solely from existing code or earlier test counts.

| # | Owner acceptance criterion | Audited status | Evidence needed to close |
| --- | --- | --- | --- |
| 1 | Individual or company can apply | Partial: signed-in independent application | Public intake for both kinds, company representative authority, safe evidence upload and authenticated continuation. |
| 2 | Administrator verifies and approves | Partial: appointed review, immutable decisions | Evidence verification, scope-specific authority and refusal/amendment cases; privileged MFA enforced. |
| 3 | Appropriate agreement signed | Partial: linked independent agreement and administrative readiness | Correct reviewed employment/independent/B2B family, effective/start/end/termination lifecycle, signer authority and real-service acceptance. |
| 4 | Unique access codes generated | Partial: existing key-passes | Stable employee/supplier identifiers, package/assignment permissions, revocation/suspension and immutable use history. |
| 5 | Seller manages assigned packages | Missing seller allocation workflow | Approved active seller sees/manages only authorised packages; suspended/expired permissions rejected server-side. |
| 6 | Correct 17% commission | Policy recorded, no seller calculation ledger | Versioned eligible-revenue definition, minor-unit rounding, partial refunds, disputes, adjustments and statements. |
| 7 | Customer payment independently verified | Partial: purchase/provider reconciliation | End-to-end trusted payment-to-sale-to-seller linkage; no browser assertion or uploaded screenshot can mark collected. |
| 8 | Finance approves/reconciles payouts | Missing | Separate creator/approver, fresh authority/MFA, correct payroll/supplier route, idempotent execution and reconciliation. |
| 9 | Payment confirmations recorded | Missing outgoing confirmations | Unique internal reference linked to authoritative provider/bank reference, currency, amount, recipient, dates and state; provider acceptance must not be labelled settled. |
| 10 | Training/professional delivery reviewed | Partial: sessions, participants and progress | Assignment acceptance, approved trainer subject/scope, evidence, customer decision/dispute and retained history. |
| 11 | Relevant activities auditable | Partial: recruitment and signing evidence | Tamper-evident, tenant-scoped, atomically persisted evidence for all new identity, scope, agreement, code, sale, delivery and finance transitions. |
| 12 | Automated permissions/finance/refund/security tests | Partial: existing recruitment/signing/purchase coverage | All new paths above, privileged MFA, no self-payout, reconciliation and rollback/concurrency/replay tests; independent real-service acceptance evidence. |

## Planned increments and dependencies

These are design tasks, not new modules already present. Extend existing routes/storage where appropriate, using a shared account/party reference and versioned engagement/permission records.

1. **Public recruitment and party/evidence model.** Public entry with abuse controls and private continuation; individual/company applications and authorised representatives; scoped upload records, quarantine/validation and verification decisions. Preserve current private applications and historical snapshots. No public access to applicant evidence.
2. **Privileged MFA and professional approval.** Extend existing authentication with enrolment/recovery and enforced privileged sessions. Distinguish applicant reviewer, professional-scope approver, package/assignment manager, certificate issuer, finance preparer and finance approver as explicit authorised capabilities. Review qualifications/demo materials and grant versioned subject/scope permissions; completion certification stays governed by the existing issuer policy.
3. **Agreement families and contract lifecycle.** Add an explicit engagement category distinct from platform roles. Reviewed employment zero-hours/part-time/fixed-term, B2B supplier and independent paths; correct legal parties and signatory authority; start/expiry/termination and version-bound signing. Block assignments outside an effective valid scope; preserve evidence after termination. Never rewrite earlier independent contracts as employment contracts.
4. **Identifiers, permissions and assignments.** Reuse key-pass and entitlement infrastructure for secure access; introduce missing employee/supplier references and explicit package/subject/assignment grants. Accept/refuse assignments, suspend/revoke access with fresh server-side checks and retained events. Refusal rights and working arrangements follow the actual agreement, not a blanket assumption across contract families.
5. **Delivery and review.** Reuse workshop sessions/attendance/progress. Link delivery to assignments, approved trainer scopes and evidence; record customer acceptance/refusal/disputes and reviewer decisions without automatic professional certification or payment settlement.
6. **Sales allocation and finance controls, still inactive.** Server-owned seller/package allocation and trusted attribution; append-only commission/service-fee accrual and adjustments; statements, privileged no-self-approval controls, payroll versus supplier obligations and unique pending payment references. Arithmetic can be tested without executing a payout; no release until independent collection and all eligibility/finance checks pass.
7. **Final financial/service integration.** Reuse purchase reconciliation and idempotent provider receipts. Connect recipient verification and supplier payment execution only in separate development/test environments first; a suitable authorised payroll path for employee obligations and controlled bank reconciliation where applicable. Verify outgoing execution/settlement/refunds/disputes/recovery and durable confirmation references. Real payment execution remains a separate owner-authorised activation decision.

## Calculation and financial invariants

- Represent the 17% rate as 1700 basis points. Use integer minor units or an exact decimal policy, never binary floating point for stored money. Version the eligibility/rounding rule, currency, sale attribution, contractual category and original provider evidence.
- Net collected package revenue is VAT-exclusive and must reflect eligible collected amounts, successful refunds and dispute holds. **Still to resolve before financial implementation:** whether provider fees or other deductions reduce the basis, treatment of discounts/partial allocations, rounding stage/tie rule, eligibility dates, currencies/FX, attribution changes and post-payout recovery. Do not invent these choices or apply them retrospectively.
- Illustrative arithmetic only: if eligible VAT-exclusive collected revenue is GBP 100.00, 17% is GBP 17.00. If a confirmed GBP 40.00 net refund reduces that eligible basis to GBP 60.00 before release, the resulting commission is GBP 10.20. This example does not decide any other deduction, tax, payroll or release policy.
- An unpaid sale has no releasable commission. A refund/dispute must prevent affected amounts from being released and create a retained adjustment/recovery obligation if already paid; never silently delete a previous earning or confirmation.
- Approval is not execution; execution acknowledgement is not settlement. Track the authoritative provider/bank state independently, with idempotency and concurrency protection. A changed recipient/payment detail or amount invalidates any stale approval.
- Finance approval must be independent of the person preparing/benefiting from a payout. Enforce self-approval restrictions and fresh scoped authority/MFA on the server, not merely by hiding UI buttons.
- Collect banking details through a suitable trusted-provider flow where possible; keep tokens/references and verification state rather than placing raw banking data in application profiles, signing audit payloads, general logs or browser storage. Payroll data has its own restricted access boundary.

## Verification plan

For each increment, test allowed and denied tenant/role/capability paths, stale sessions/roles, suspension, expiry, amendments and history. Include document access and malicious/unsupported upload cases; no self-scope approval where independence is required; no automatic certificate grant from a job title or application checkbox.

Exercise assignment refusal/acceptance races, code replay and revocation, contract termination, scoped trainer delivery and customer disputes. For finance test every eligibility boundary, partial/full refunds, disputes and reversals, duplicate/out-of-order trusted events, wrong currency/amount/recipient, concurrent approvals and transaction rollback. Statements must reconcile to retained entries and independent collections/disbursements.

Retain test evidence distinguishing unit tests, real database/browser flows, service doubles, real test-environment service calls and any later production activation. Earlier signing, purchase and recruitment passes do not prove the expanded module complete. No new implementation tests were run for this documentation-only update.

## Current operational handover

The latest owner-local evidence shows migrations 037 and 038 applied to `127.0.0.1/fresh_fra_esign_dev`. The real-service signing readiness check subsequently failed; `aws sts get-caller-identity --profile fresh-fra-app` reported expired session credentials. The owner restarted `aws login --profile fresh-fra-local --region eu-west-2`, but no successful completion/readiness result has yet been provided. The linked candidate-agreement real-service acceptance therefore remains **unverified**, not passed.

The separately requested Agent Toolkit setup for a project in `eu-north-1` is not completion of that London S3 authentication flow and does not move the existing bucket or application region. Resume that setup separately with its required profile input. Preserve the existing S3 region until an explicit migration is planned.
