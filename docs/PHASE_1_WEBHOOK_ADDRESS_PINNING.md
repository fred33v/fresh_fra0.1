# Phase 1 — Outgoing webhook address pinning

Local Phase 1 follow-up. This implements the DNS/address-pinning gap recorded in the earlier webhook-delivery and domain-publication documents. It is not production deployment or Phase 1 acceptance evidence.

## Behaviour

Production webhook attempts now resolve the receiver once, validate every returned address, and pass that exact address set to the HTTPS socket's lookup callback. A subsequent DNS change cannot replace the checked destination during connection. Every attempt resolves and validates again; retries do not reuse a previous attempt's approved answer.

The original URL hostname, path and query are preserved. Node HTTPS therefore retains Host/SNI and normal hostname verification, with `rejectUnauthorized: true` explicitly set. A fresh agent is used for each attempt. Native HTTPS does not follow redirects; their status continues through the existing retry policy. Response bodies are destroyed after reading the status rather than retained.

The ten-second attempt deadline covers DNS and the subsequent HTTPS request. A late DNS resolution after timeout cannot initiate a request. HTTP status values and the network-failure value 0 remain unchanged, as do payloads, HMAC signatures, event and delivery IDs, outbox leases and retry scheduling. Development/test retains the existing fetch transport and does not claim production DNS pinning.

Address filtering now handles IPv4-mapped IPv6 in both dotted and hexadecimal forms, additional local/special address ranges, and trailing-dot localhost names. Any mixed public/private DNS answer set is refused as a whole. HTTPS and the prohibition on URL credentials remain required in production.

## Verification

**60 tests passed across three suites**: signed enterprise webhook delivery, durable retry policy and the new production transport contract. Backend typecheck, `npm run build` and changed-source lint passed. New cases exercise pinned single/all-address lookup, one DNS resolution per attempt, unchanged hostname and signatures, public IPv6 literals, mixed DNS answers, private IPv4/IPv6 variants, empty/failed DNS, redirect non-following, retry-time revalidation, DNS timeout/late resolution and HTTPS abort/error behaviour.

All network primitives in the production transport tests are mocked. No real receiver, external message, production database write, migration or deployment was used. Backend typecheck/build and changed-source lint are checked separately; this is not a full monorepo or remote CI result.

## Rollout and limits

No migration or dependency change is required. Production hosts must allow direct outbound HTTPS to the receiver's public addresses and trust its TLS certificate. The pinned native transport does not route through a generic HTTP proxy, because a proxy performing its own DNS resolution would defeat this guarantee. Proxy-only deployments need a separately reviewed solution that preserves destination validation.

This closes the local DNS time-of-check/time-of-use gap for webhook sends only. It does not implement an organisation-wide retention/visibility policy, independent review, real authenticated browser-to-PostgreSQL CI, durable SSE replay, or production schema rollout. Native mobile development remains suspended.
