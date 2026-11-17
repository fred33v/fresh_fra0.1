# Workshop navigation authority — 13 November 2026

The workshop API already allows account-level administrators or users assigned the workshop `facilitator` role to create sessions. The web client previously required the assigned facilitator role even for account administrators. Its header also advertised the facilitator dashboard to a workshop `admin` role alone, which does not grant session creation on the server.

The auth context now recognises an account administrator when checking facilitator authority, without adding persisted workshop roles or changing other role checks. The route guard, workshop landing behaviour and facilitator navigation therefore use the same effective authority. The header no longer treats a workshop `admin` role alone as facilitator permission. Refreshing the account role removes implicit authority if the account is no longer an administrator.

This is a client-side alignment with the existing API, not an expansion of server permissions. Session ownership checks, organisation boundaries, package gates and account-role guards remain in force. No mobile code, migration or dependency is changed.

Verification: auth-context, header, protected-route and workshop-page suites pass. Application and test TypeScript checks and changed-file lint pass. Tests cover account administrators without workshop roles, assigned facilitators, workshop administrators without facilitator authority and loss of implicit authority after profile refresh. These are unit/component checks, not a live role-change or production acceptance record.

Other role assignment, stale server JWT authority, workshop cross-worker delivery and durable SSE replay require separate review. This change does not claim to close those tasks.
