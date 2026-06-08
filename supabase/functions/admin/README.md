# `admin` edge function

The admin UI (`admin.html`) calls this single password-checked Edge Function via
`sbAdmin(auth, action, payload)` in `cms.js`. Actions: `login` · `save` · `upload` ·
`list_subs` · `set_password`. It runs with the **service role** and is the only writer
to `site_content` / `admin_config` and the only reader of the `subscribers` list — the
real security boundary for the CMS.

Source: [`index.ts`](index.ts) (deployed; `verify_jwt = false` — it does its own auth).

## Session token (implemented — review #4)

`login` verifies the password once and returns a short-lived **HMAC-signed token**
(8h, signed with a key derived from the service-role key — no extra secret needed).
Every other call sends the **token** instead of the raw password, and the client stores
the token, not the password. The raw password is still accepted as a fallback, so an
expired token can never lock the admin out.

```
supabase functions deploy admin --no-verify-jwt
```

## Implemented hardening

- **Hashed password.** `admin_config.password` is stored as `pbkdf2$<iters>$<salt>$<hash>`
  (PBKDF2-HMAC-SHA256, WebCrypto, no external dep). A legacy plaintext value is accepted
  once and transparently upgraded to a hash on the next successful login. Comparisons are
  constant-time.
- **Token revocation.** Tokens embed `session_version` (column on `admin_config`).
  `set_password` bumps it, so changing the password instantly invalidates every
  outstanding token instead of waiting out the 8h TTL.
- **CORS allowlist.** Responses reflect only allow-listed origins (`slimeby.com`,
  `www.slimeby.com`, localhost), not `*`. Override with the `ALLOWED_ORIGINS` env
  (comma-separated) without redeploying.
- **Login rate limiting.** Best-effort per-IP lockout (8 failures / 15 min) on password
  attempts; cryptographic token auth is not throttled.
- **Upload validation.** Server enforces a content-type allowlist
  (`image/jpeg|png|webp|gif`) and an 8 MB cap after base64 decode, and writes to a random
  `crypto.randomUUID()` object key rather than the client-supplied filename.

## Remaining hardening (recommended)

- **HttpOnly cookie tokens.** The token currently rides in JSON and is kept in
  `sessionStorage`. If the admin is served same-site with the function, set it as an
  `HttpOnly; Secure; SameSite=Strict` cookie so page JS can't read it at all.
- **Phone-merge.** Sign-ups are inserted client-side (anon INSERT). To merge a later
  phone onto an existing email, add a `subscribe` action here (service role, upsert on
  `email`) and route the join form through it.
