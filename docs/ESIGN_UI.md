# Electronic signing interface

Managers (`employer` or `admin`) can open **Documents to sign** from their account menu, or visit `/signing` in the Web dashboard. The API rechecks their persisted role and organisation on every request. There is no additional package gate for this module.

## Sender journey

1. **Document** — upload a PDF up to 1 MB and give it a title. Drafts are saved on the server. The Web limit leaves room for multipart metadata under the default 1 MiB API request limit.
2. **Recipients** — add up to 20 named email recipients. Recipient identities cannot currently be edited through this interface; check them before adding.
3. **Fields** — preview the prepared PDF, select a recipient and click to place signature, name or date fields. Switch pages, remove fields and adjust their coordinates/size. Keyboard users can use Add field and the labelled numeric controls. Every recipient needs a signature field. Local edits are saved with **Save fields & review**; leaving this step before saving discards those layout edits.
4. **Review & send** — review the recipients and confirm before sending. The backend locks the document, identities and layout at send time. Partial invitation delivery failures are displayed honestly, with individual resend controls. Resending invalidates that person's previous link.

The document list is scoped to the manager's organisation, paginated in batches of 25. The status filter applies to the current page. Sent documents refresh every 10 seconds while their detail page is open. Expired invitation links cannot be resent without extending the document's lifetime (not offered by this UI). Completed and declined documents remain retained.

The detail screen includes prepared/signed PDF downloads, retained evidence download, on-demand audit-chain and retained-checkpoint verification, and a safe retry when all signatures are recorded but final sealing is still pending. Audit verification can fail if S3 is unavailable; it is never represented as verified in that case.

## Signer journey

Private email links still open on the API origin, without a dashboard login. The script-free pages now use a local responsive stylesheet, an email-code delivery notice, and HTML error/recovery pages for invalid codes, rejected origins and stale decisions. API callers continue to receive JSON errors. The verification, consent, CSRF binding and sealing rules are unchanged. No third-party fonts, tracking or scripts are loaded. The signer CSP permits only same-origin styles and forms.

## Local preview with your existing test backend

Keep the backend running on port 3080 with its existing private configuration. In another terminal, from the project root:

```bash
VITE_API_URL=http://localhost:3080 npm --prefix apps/fra-web-dashboard run dev
```

Open `http://localhost:8080/signing` and sign in using an employer/admin account on the **same local database**. The automatic demo creates a separate private test account; its random password is not a normal user credential to copy into chat. Use your own locally registered and verified manager account for the dashboard. A generic account-confirmation link targets the Web frontend; the actual signing invitation targets the API origin.

Keep `ESIGN_PUBLIC_URL=http://localhost:3080` for local signing invitations. Production requires HTTPS and deployment-specific secrets. This interface does not provide an advanced or qualified signer identity.

## Validation

- Web tests: `pnpm --filter @stopfra/web-dashboard test --run src/__tests__/pages/Signing.test.tsx src/__tests__/lib/esign.test.ts src/__tests__/lib/api.test.ts`.
- Real PDF canvas/worker and responsive sender journey against a mock API: `pnpm --filter @stopfra/web-dashboard test:e2e:signing`. Install Playwright Chromium first; optionally set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for a local system installation.
- The existing disposable PostgreSQL integration checks now cover organisation-scoped document listing and pagination validation, plus real-browser error recovery from an invalid email code. Its email and storage transports remain captured/doubled; it never uses live SMTP or AWS.
- GitHub database CI also runs the sender UI journey after installing Chromium.
