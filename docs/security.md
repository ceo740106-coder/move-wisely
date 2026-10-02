# MoveWisely security model

## Browser

The browser receives only Supabase client-safe configuration. Reports are cached per authenticated user in local storage without raw PGN text. The app never stores a Supabase service-role key.

Stockfish executes in a dedicated Web Worker and does not receive secrets.

## Supabase

Profiles, analysis reports, and training progress are protected with Row Level Security. Every read/write/delete policy requires the authenticated user id to match the owned row. Anonymous table access is revoked.

The profile trigger is `security definer` with an empty search path and fully qualified table/function references.

## Chess.com ingestion

Chess.com player/game retrieval runs server-side. The caller's Supabase access token is validated before the public-data request. Requests are bounded by username format, game limit, an archive-month scan cap, caching, retry-on-429 behavior, and per-user scan limits.

## Cloudflare Worker

The Worker adds CSP with a fresh per-response nonce, HSTS, frame protection, MIME-sniffing protection, Referrer-Policy, Permissions-Policy, cross-origin isolation headers where safe, no-store handling for personalized HTML/JSON, request-size limits, and a Cloudflare Rate Limiting binding as a defense-in-depth edge control.

## Server functions

TanStack Start server functions use CSRF middleware. Keep `@tanstack/react-start` and `@tanstack/start-server-core` on patched versions and redeploy after security advisories.

## Operational security

Use MFA for the Supabase organization, enable email confirmation, review Security Advisor findings, use custom SMTP, configure attack protection/CAPTCHA, and keep dependencies pinned and reviewed. See `docs/launch-readiness.md` for the production checklist.
