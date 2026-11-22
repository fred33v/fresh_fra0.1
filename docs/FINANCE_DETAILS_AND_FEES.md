# Finance beneficiaries, service fees and payroll handoff

Migration 046 extends the existing recruitment and commission module. It does not replace its ledger or change the 17% VAT-exclusive commission calculation. Apply the preceding stacked migrations in order before 046; no production migration or payment execution was performed during development.

## What is covered

The authenticated `/finance` page collects UK account-holder names, sort codes and account numbers for existing SUP supplier or EMP employee identifiers. Full bank details are encrypted with AES-256-GCM and profile-specific authenticated context. Ordinary API responses expose only masked last-four digits. Every bank amendment creates a new version requiring fresh, independent finance review. Review is a **staff evidence attestation**, not automated bank ownership verification.

After migration 047, finance access requires a verified operator identity, a separate database-backed finance role and a recent MFA login. The former `FINANCE_AUTHORISED_USER_IDS` allowlist no longer grants authority. See MFA_AND_FINANCE_ROLES.md for enrollment and independent grants. Revealing bank details additionally requires the current password, is rate limited and audited, and the UI hides revealed details after 60 seconds. Password re-entry is **not MFA**. Migration 047 adds privileged MFA; password re-entry remains an additional bank-reveal safeguard.

Supplier fees are fixed GBP quotes with separate net and VAT amounts and recorded terms. The supplier must accept the exact version. Preparing, approving or recording a fee instruction requires customer-accepted delivery, a matching purchase and trusted payment reconciliation with no refund or dispute. This deliberately conservative service-fee rule does not change proportional-refund commission calculations.

Payroll instructions require an EMP identity, approved payroll beneficiary, gross amount and non-overlapping period. They are a handoff to an external payroll process: no PAYE, NIC, pension, RTI or net-pay calculation is provided. A recorded payroll instruction attests to an external payroll run; its gross figure is not a net bank transfer amount.

Instructions require independent finance approval; preparers and beneficiaries cannot approve their own payments. Changing bank details blocks instructions bound to an older profile. Cancellation remains possible after suspension or revocation. Unique request keys, row locks and database constraints prevent duplicate instructions.

New commission instructions bind to the current approved bank profile once a supplier has submitted payment details. Historical suppliers with no submitted profile retain the explicitly labelled legacy external-bank workflow. Existing bank trace references and ledger amounts are preserved. No silent fallback is allowed after a profile has been submitted.

Instruction references are generated from UUIDs. Confirmation references are generated only when recording is complete. These are internal identifiers, not bank-issued proof or BACS-format references. Staff still enter the actual external transaction or payroll-run reference and explicitly attest to checking it. The existing commission statement displays both references separately.

## Local configuration

From `apps/fra-backend/backend`, generate a private test keyring without printing its secret:

```sh
node --input-type=module <<'NODE'
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
mkdirSync('.local/finance', { recursive: true, mode: 0o700 });
writeFileSync('.local/finance/vault-keys.json', JSON.stringify({
  activeKeyId: 'v1', keys: { v1: randomBytes(32).toString('base64') }
}), { mode: 0o600, flag: 'wx' });
console.log('Private keyring created; no key printed');
NODE
```

Configure the backend's private `.env.local`:

```ini
FINANCE_VAULT_KEYS_FILE=/absolute/backend/path/.local/finance/vault-keys.json
```

Configure the existing reviewer organisation, enroll MFA and have an independent operator admin assign the finance role. Do not paste bank details or keys into chat or commit them. Missing keys disable collection and revelation. Production requires a vault-managed mounted keyring file with private permissions; inline `FINANCE_VAULT_KEYS` is permitted only for development/test. Preserve old key IDs during rotation and securely back up the keyring: losing keys makes existing profiles unreadable. The ignored local directory is not a production secret manager.

Open `/finance` after login. Own records are the default; the review view is restricted to authorised finance users. Delivery administration links to the fee proposal context. Lists currently return the latest 200 records. Provider commission statements remain separate.

## Audit and boundaries

Profiles, fee versions, instructions and their chained event snapshots are retained without automatic purge. Event snapshots exclude encrypted bank payloads and full account/sort-code fields; masked metadata remains auditable. Do not put banking credentials into free-text evidence references or reasons. Authorised bank reveals are logged without the revealed values.

This module does not execute transfers, provide independent bank reconciliation or complete employment/payroll compliance. Privileged MFA is provided by migration 047. Stripe Connect remains deferred. Use a separate review before collecting production banking data or deploying payroll workflows.

## Validation

On a disposable PostgreSQL 17 database, migration 046 and five grouped integration scenarios passed, including actual existing commission preparation/review/record routes, bank-version invalidation, independent approval, concurrent payroll periods, audit rollback, refunds and immutable histories. The existing recruitment/commission regression suite passed 98 checks. Backend unit tests passed 125 tests; frontend tests passed 793 tests. All five build tasks passed. Lint has five existing unrelated warnings and no errors. Trusted payment responses in integration tests are synthetic; no real funds were moved. Hosted CI for this stacked PR runs only after its base is retargeted to the repository's configured main branch.
