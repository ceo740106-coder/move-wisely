# Release checklist

Run this before every production release:

```bash
npm install
npm run verify
```

Then confirm:

- Supabase production URL and publishable key are correct.
- No secret/service-role credentials are in build variables.
- Supabase migration is applied and RLS is enabled.
- Email confirmation and Auth attack protection are configured for the intended audience.
- Cloudflare Rate Limiting namespace id is unique in the account.
- The production domain/redirect URL is registered in Supabase Auth.
- The current dependency tree has no known critical security advisory.
- A fixed chess reference suite has been checked against the shipped Stockfish configuration.
- Club pilot feedback has been reviewed before a national release.
- Third-party notices are included with the release.
