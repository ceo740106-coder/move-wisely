# MoveWisely launch readiness

This repository is prepared for a controlled club pilot and a later national rollout. Publishing still requires production configuration and real-world validation.

## Before the first club pilot

- Apply `supabase/migrations/0001_initial.sql` to the production Supabase project.
- Enable email confirmation in Supabase Auth.
- Configure the exact production Site URL and redirect URL.
- Keep only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Cloudflare build environment.
- Never add a service-role/secret key to frontend variables.
- Run the repository verification command locally.
- Test email sign-up, email confirmation, password reset, sign-in, sign-out, report save/load, report deletion, training progress, PGN import, Chess.com import, light/dark mode, board flip, puzzle solving, and mobile layout.
- Run a small set of known reference positions through the analysis pipeline and compare results with a trusted Stockfish desktop reference configuration.

## Before national launch

- Enable Supabase SSL enforcement and database network restrictions where compatible with the operating model.
- Review Supabase Security Advisor results.
- Protect the Supabase organization with MFA and use strong administrator credentials.
- Configure custom SMTP for branded transactional emails.
- Configure Supabase Auth attack-protection/CAPTCHA according to expected signup volume.
- Decide on the minimum production data-retention period and document it in the privacy policy.
- Set up monitoring and an incident-response contact.
- Validate Cloudflare rate-limit behavior from multiple networks.
- Complete a legal review of the site's terms, privacy notice, data-retention policy, and any monetization flow before taking payment.

## Quality gates

### Chess-analysis correctness

The code uses Stockfish 19 for move evaluation and deeper confirmation of significant errors. This is an engineering foundation, not a statistical certification. A public claim such as “90%+ correct” should only be made after benchmarking against a fixed reference suite and documenting the engine version, depth, time budget, and pass criteria.

### Competition-preparation usefulness

The product derives priorities from engine-confirmed losses, opening recurrence, clock pressure, opponent rating bands, and the player's own positions. A public usefulness score should be measured from pilot outcomes (for example, task completion, repeat-error reduction, and structured player/coach feedback) rather than assigned by the application itself.
