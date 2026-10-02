# MoveWisely

MoveWisely is a competition-focused chess training platform built around a player's own games. It imports public Chess.com games or PGN files, evaluates every player move with Stockfish 19 in the browser, confirms significant losses at deeper depth, and turns recurring problems into a structured competition-preparation plan.

## Product goals

MoveWisely is designed for:

- club players preparing for tournaments
- players who want to understand recurring decision errors, not just individual blunders
- coaches who need a compact handoff report based on a player's own games
- a later national rollout where privacy, reliability, and repeatable training matter

The product intentionally separates **engine evidence** from **practical interpretation**. The app does not claim to reproduce Chess.com's proprietary accuracy score.

## Stack

- React + TanStack Start
- Cloudflare Workers + Cloudflare Vite plugin
- Supabase Auth + Postgres + Row Level Security
- chess.js for legal game-state reconstruction
- Stockfish 19 lite single-threaded in a Web Worker
- Tailwind CSS 4
- Zod validation on server inputs

## Core features

### Analysis

- Chess.com public game import
- PGN paste/upload for OTB and other platforms
- Bullet, blitz, rapid, and daily time classes
- up to 30 games per report
- two-pass Stockfish analysis
- deeper verification for significant losses
- centipawn-loss severity bands
- concrete secondary tags for tactics, calculation, hanging pieces, opening, endgame, pawn structure, and time pressure
- opening profile and opponent-rating bands
- clock-pressure normalization when PGN clock data exists

### Training

- engine-verified mistake positions
- real “Fix it” mode: play the position before revealing the engine answer
- principal variation reveal
- 21-day competition plan
- simulation days and taper period
- task completion persisted to Supabase
- deterministic coach handoff brief with no external AI service

### UI

- responsive Chess.com-style board geometry and interaction model with original MoveWisely piece artwork
- drag/drop and tap-to-move
- legal move indicators
- last-move highlight
- check highlight
- engine arrows
- board orientation flip
- promotion picker
- light/dark theme toggle
- mobile-first report layout
- print/export/delete controls

## Chess analysis methodology

A player's move is compared with the engine's best move from the player's perspective. Significant losses are rechecked at a deeper search. Current severity bands are:

- **Inaccuracy:** 50–99 cp lost
- **Mistake:** 100–299 cp lost
- **Blunder:** 300+ cp lost

MoveWisely Accuracy is a transparent monotonic transformation of average engine loss:

`100 × exp(-average CPL / 300)`

It is a MoveWisely metric and is **not** Chess.com's CAPS2 score.

See `docs/analysis-methodology.md` for the complete method and limitations.

## Security model

Supabase owns authentication and user data. Row Level Security isolates every profile, report, and training row by authenticated user id.

Chess.com retrieval happens server-side only after validating the caller's Supabase access token. The request is bounded by input validation, caching, a per-user scan limit, an archive-month scan cap, retry-on-429 behavior, and a Cloudflare edge rate-limit binding.

The Worker adds CSP with a per-response nonce, HSTS, frame protection, MIME-sniffing protection, Referrer-Policy, Permissions-Policy, cross-origin policies, request-size limits, and `no-store` for personalized HTML/JSON responses.

No service-role database credential is required by the application. Do not add one to frontend build variables.

## Supabase setup

1. Create a Supabase project.
2. In Authentication, enable Email/password.
3. For production, enable email confirmation and configure the exact production Site URL and redirect URL.
4. Run `supabase/migrations/0001_initial.sql` in the Supabase SQL editor or apply it with the Supabase CLI.
5. Copy `.env.example` to `.env` and set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Only these client-safe values belong in the browser.

For a national rollout, also enable Supabase SSL enforcement, review Security Advisor, protect the Supabase organization with MFA, use custom SMTP, and configure Auth attack protection/CAPTCHA as appropriate for your signup volume.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:8080`.

## Verification

```bash
npm run verify
```

The command runs the legacy/brand scan, lint, tests, TypeScript checking, and a production Vite build.

## Cloudflare deployment

This repository is structured for the Cloudflare Vite/TanStack Start deployment model and includes `wrangler.jsonc` and a Worker entrypoint.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the **Cloudflare build environment** because Vite embeds these client-safe values at build time.

Then:

```bash
npm install
npm run verify
npx wrangler login
npm run deploy
```

`wrangler.jsonc` includes a Cloudflare Rate Limiting binding. The namespace id must be unique within your Cloudflare account; change `51001` if that identifier is already used in your account.

## GitHub

Commit the source, migrations, docs, CI workflow, and the lockfile generated by your own `npm install`.

Never commit:

- `.env`
- `.dev.vars`
- Supabase service-role/secret keys
- Cloudflare API tokens
- local build output

GitHub Actions is configured in `.github/workflows/ci.yml`.

## Production launch

Use `docs/launch-readiness.md` before inviting the first club members and before a national release.

A public claim such as “90%+ chess-analysis correctness” or “80%+ training usefulness” should only be made after benchmarking the shipped engine configuration against a fixed reference suite and measuring player/coach outcomes. The codebase is engineered around those goals; it does not manufacture a certification score.

## Third-party licensing

Stockfish is GPL-3.0 licensed. See `THIRD_PARTY_NOTICES.md`.

MoveWisely is an independent product and is not affiliated with Chess.com.
