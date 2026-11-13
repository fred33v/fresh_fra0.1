# Web workshop SSE reconnection — 13 November 2026

Follow-up to Phase 1 on main commit `6a63116`. Native development remains suspended.

## Repair

The browser previously relied on native EventSource reconnection, which reuses its URL. The SSE credential in that URL is single-use, so a disconnected stream could not authenticate again. The client now closes the failed EventSource and exchanges a fresh token before every retry. Token-exchange failures retry with exponential delays from one second to a maximum of thirty seconds; a successful stream opening resets the delay. Cleanup cancels pending retries, and a late token response cannot open a stream after cleanup or a session/account change. Events from a previous session or source are ignored.

Redis token consumption previously used separate GET and DEL requests. It now uses atomic GETDEL, matching the account-link repair, so concurrent claims cannot both authenticate. Existing key names, five-minute expiry and memory fallback are preserved. Both JSON strings and Upstash's automatically deserialized objects are supported.

## Verification

- Backend: 74 tests passed across workshop, workshop-memory and new SSE-token suites.
- Web: 12 tests passed across session-refresh and new SSE reconnection suites.
- Backend production TypeScript and dashboard application/test TypeScript checks passed.
- Changed production files and the new frontend test pass lint.
- Frozen-lockfile dependency installation completed with lifecycle scripts disabled after native Skia's download failed. The correct pinned pnpm 9.15.4 was used; no lockfile changes were made.

Tests use mocked EventSource and mocked Redis; no live Redis or real-browser disconnect test is claimed. No migration, deployment or native application changes are required. This is a focused verification, not a full CI acceptance record.

## Limits

SSE remains a live notification channel, without durable replay or Last-Event-ID recovery. Events sent while disconnected can still be missed. This change does not implement workshop role alignment, cross-worker broadcast, stream revocation, or event replay. Roll out updated backend workers together to avoid leaving old non-atomic claim handlers active; reload browser tabs to use the updated reconnect client.
