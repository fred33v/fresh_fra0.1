# Phase 2 and 3 continuation — 19 November 2026

Starting main: `75f5f17efede3f49acebba5236ec8db771d6eb83`.

The repository contains several historical phase plans with different numbering. For this continuation, the working sequence is backend verification followed by frontend integration. This does not accept old percentage-complete or production-ready claims. The earlier `phase-2/web-backend-review` branch was merged through PR #78; it is not an unfinished independent phase.

## Backend verification

Current main CI passed its build, tests, typechecking, PostgreSQL migration/provider/signing checks and authenticated browser checks. Provider review fixes are included through PR #86. The accepted financial workflow is a 17% VAT-exclusive commission ledger with independently approved records of manual bank settlements, not Stripe Connect transfers.

The backend remains the authority for verified accounts, current reviewer authority, accepted sales assignments, self-referral rejection, immutable purchase attribution, verified payments, refund/dispute adjustments and payout reservation/approval. This increment changes no backend route, migration, payment rule or money movement.

## First frontend integration increment

- Approved applicants see “Your provider portal”.
- An accepted/completed sales assignment exposes a customer referral URL and a copy button, with a manual-copy fallback. Instructions tell the customer to use their own organisation account.
- An unauthorised checkout returns through the existing safe same-site sign-in return path, preserving the selected package and the current referral field, including a reference entered manually.
- A component journey exercises checkout → sign-in → checkout → simulated purchase retry and checks that the referral reaches purchase creation. API responses and authentication are controlled test doubles; no real Stripe payment or server-side commission is proved by this test.
- The regression cases fail on the original frontend. Existing authentication return-path protections and the purchase server's eligibility checks remain in force.

The current increment does not establish the entire onboarding journey: a newly registered customer's separate email-verification tab, profile navigation for every application status, and the full deployed provider/reviewer/customer journey need their own acceptance checks.

## Open acceptance gates

Final Phase 1 acceptance remains open. Before target activation, verify migration history through 039, the operator organisation and two verified reviewers using `providers:check`, deployed HTTPS/proxy behaviour, real payment/refund/dispute webhook delivery, the intended production seal and retained signing checkpoint, and database ownership separation. The current workspace has no configured target connection or credentials; no production deployment, data change or funds movement is performed here.

Continue frontend integration and isolated tests while recording these gates separately. Do not report Phases 1, 2 or 3 as complete solely because this incremental frontend change passes.
