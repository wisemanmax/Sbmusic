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

## Remaining hardening (recommended)

- **Hash the stored password.** `admin_config.password` is currently plaintext. Have
  `set_password` store a hash (e.g. scrypt/bcrypt) and `login` compare against it.
  Migrate by accepting the existing plaintext once, then writing the hash.
- **HttpOnly cookie tokens.** The token currently rides in JSON and is kept in
  `sessionStorage`. If the admin is served same-site with the function, set it as an
  `HttpOnly; Secure; SameSite=Strict` cookie so page JS can't read it at all.
- **Phone-merge (review #6).** Sign-ups are inserted client-side (anon INSERT). To merge
  a later phone onto an existing email, add a `subscribe` action here (service role,
  upsert on `email`) and route the join form through it.
- **Rate-limit `login`.**
