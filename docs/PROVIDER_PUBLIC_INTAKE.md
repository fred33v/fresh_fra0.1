# Public provider intake

Closes the last Section 1 gap of the Hire, Sell & Earn module: a signed-out visitor can find the programme and apply.

## Decision: no new unauthenticated write endpoint

The application API (`/api/v1/provider-applications/me`) still requires a signed-in account with a verified email.
That is deliberate. The account sign-up route already exists, is rate limited, does not reveal whether an address is
registered, and proves ownership of the email address. Putting a second anonymous "submit an application" endpoint
beside it would add an abuse surface (spam, enumeration, applications for other people's addresses) that the existing
route in already handles. The application row stays tied to a verified account and organisation, so uploads,
amendment, review and audit are unchanged.

## What changed (dashboard only)

- `/become-a-provider` is a public page (no `ProtectedRoute`): what the programme is, the five steps, what to expect.
  Signed-out visitors get "Create an account and apply" (`/auth?mode=signup&returnTo=/provider-application`) and
  "I already have an account"; signed-in users go straight to their application. Linked from the site footer.
- The confirmation email opens a fresh page without `returnTo`, so a new applicant used to land on the dashboard.
  `lib/pending-return.ts` remembers the same-site path in `localStorage` when the account is created and `Auth`
  uses it after confirmation (an explicit `returnTo` still wins). It expires after 24 hours, is cleared on first use,
  is re-validated with `safeReturnPath` on the way out, and the page works without storage.

## Not done

Nothing is stored for a visitor who never creates an account. If a no-account "register interest" form is wanted, it
needs its own abuse limits (per-IP and per-address rate limits, CAPTCHA decision, retention) before building.

## Tests

`pending-return.test.ts` (validation, expiry, tampering, unavailable storage), `BecomeProvider.test.tsx`,
`Auth.provider-intake.test.tsx` (remembered on sign-up, used after the emailed link, explicit `returnTo` wins).
