# Phase 1 — Frontend typecheck gate

> Follow-up: [atomic publication and assessment budget planning](PHASE_1_DOMAIN_PUBLICATION_AND_BUDGET.md) now implements the publication/planning gaps described below locally. Earlier validation counts remain historical.

## Problem and scope

The dashboard's former `tsc --noEmit` command loaded a solution config with `files: []` and did not check its referenced projects. A successful run was therefore not evidence that application code compiled. Direct compilation exposed inherited application errors and stale test fixtures.

The dashboard `typecheck` script now checks four projects explicitly, in order: application source, Vitest tests and setup, Node build/test configuration, and Playwright tests. Unit tests have their runtime globals and Vite environment declarations. They are excluded only from the application project and remain checked by the test project. Strict checking, unused-local/parameter checking and fallthrough checking remain enabled; Node configuration now also checks unused declarations. The existing root Turbo command and CI typecheck step invoke this script without changing check names.

## Repairs

- Use React Router 7's supported router props and DayPicker 9's navigation components and class names; preserve date selection and navigation.
- Use the authenticated `userId` for assessment selection and local checklist keys. Key the checklist form by account and resource kind so an account switch cannot copy the previous account's answers into the next account's storage. Existing storage is not deleted or assigned to another account; old anonymous answers cannot be safely attributed to a particular user.
- Use React 19's exported element type, import the workshop quiz type locally as well as re-exporting it, and keep email verification's return value consistent with its declared contract.
- Define the dashboard planning draft models separately from the shared training-course models; type the progress fields the backend actually returns and derive allocated-budget progress from mitigation budgets.
- Declare the already-imported UI workspace dependency, expose its source declarations before builds, and translate numeric/native tokens to CSS units and shadows. Runtime package exports still target built JavaScript. Dashboard-specific palette values are preserved.
- Bring unit mocks up to current hook contracts. Typecheck Vite, Vitest, Tailwind and Playwright config; put the existing 80% coverage thresholds in Vitest's supported `thresholds` object. Coverage itself is a separate command and was not measured in this change.
- Respect the existing Playwright navigation timeout parameter, retain the ARIA element count, and remove unused audit locals/imports. These compile repairs do not establish WCAG conformance or replace the simplified audit helpers.

## Verification

Validation was performed in the isolated repair checkout, not the user's Mac checkout or a production environment.

- The actual dashboard package `typecheck` command passes all four projects.
- Temporary deliberate source and unit-test type errors were rejected with TS2322, proving both projects are checked. Probe files were removed afterwards.
- Dashboard production build and UI-core build pass.
- Dashboard lint has no errors and five existing warnings.
- Full dashboard unit suite: 725 tests across 63 files pass, including calendar and account-switch regressions. The subsequently added CSS-token conversion test passes separately (one test).
- Two certificate browser contract tests pass. They exercise mocked API responses, not a production service.

## Remaining functional gap

A passing compiler is not evidence that every workflow is implemented. The dashboard planning hook still calls `/budget-guide/risk-appetite` and `/budget-guide/mitigation` endpoints that the backend does not provide, and its progress fetch does not restore these drafts. The shared `BudgetGuideRiskAppetite` and `BudgetGuideMitigationStrategy` describe different training-course models and must not be aliased or cast to conceal that mismatch. Preserve both models while implementing and testing an explicit persistence contract in a separate Phase 1 change. This repair does not claim that the budget-planning workflow or all of Phase 1 is complete.

## Delivery

This commit follows the transaction/permission and certificate-lifecycle repairs on baseline `5fcfb4d89749a729aae5274d533ee5e337b09d75`. A cumulative mailbox patch contains all three commits and is intended for a clean separate checkout at that baseline. Do not apply the cumulative patch again where its earlier commits are already present. No production migrations, deployment, GitHub push or merge were performed here.
