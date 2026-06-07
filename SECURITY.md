# SLIME BY — security & deployment notes

This is a static, no-build site (`*.html` + `assets/app.js` + `cms.js`) with a Supabase
backend (content + subscribers + a password-checked admin edge function).

The items below need **backend access or host/deployment config** that lives outside this
repo, so they are documented here rather than coded. Everything is paste-ready; **test on
a preview deployment before promoting to production** (a wrong CSP silently breaks fonts,
the Spotify/YouTube embeds, or the Supabase calls).

Already hardened in code (see `assets/app.js` / `cms.js`): the preview `postMessage`
channel is origin/source-gated, all CMS rich-HTML goes through an allowlist sanitizer,
every URL/CSS value is sanitized (`cleanUrl`/`safeImg`/`cssUrl`/`safeColor`), and the
admin editor fails loudly on a bad content read (`sbGetContentStrict`).

---

## 1. Security headers / CSP  (review #15)

Serve these from the host. The site's real external dependencies are:

| Purpose | Origin |
|---|---|
| Fonts (CSS) | `https://fonts.googleapis.com` |
| Fonts (files) | `https://fonts.gstatic.com` |
| Content + edge function | `https://rccwnyghfiinpoexvtwp.supabase.co` |
| Spotify embed | `https://open.spotify.com` |
| YouTube embeds | `https://www.youtube.com` (+ `https://www.youtube-nocookie.com` if used) |
| Release/cover images | `https://i.scdn.co` (covered by `img-src https:`) |

### Recommended header set

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self'; connect-src 'self' https://rccwnyghfiinpoexvtwp.supabase.co; frame-src https://open.spotify.com https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Permissions-Policy: geolocation=(), camera=(), microphone=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

> **Why `script-src 'unsafe-inline'` is still here:** the pages use inline `<script>`
> (the `sb_seen`/wipe head snippet) and inline `onclick=` handlers. Dropping
> `'unsafe-inline'` requires review **#19** (move the head script to a file + nonce,
> convert `onclick` to delegated `data-action` handlers). Even *with* `'unsafe-inline'`,
> the `connect-src` / `frame-src` / `object-src` / `base-uri` limits above meaningfully
> cap what injected script could do (exfiltration targets, plugin/base-tag abuse).
>
> `style-src 'unsafe-inline'` is required: inline `style=""` and CMS-applied
> `element.style` are pervasive. `img-src https:` is broad on purpose — CMS cover art
> can point at any HTTPS host.

### Vercel — `vercel.json`

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self'; connect-src 'self' https://rccwnyghfiinpoexvtwp.supabase.co; frame-src https://open.spotify.com https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Permissions-Policy", "value": "geolocation=(), camera=(), microphone=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
      ]
    }
  ]
}
```

### Netlify / static `_headers`

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self'; connect-src 'self' https://rccwnyghfiinpoexvtwp.supabase.co; frame-src https://open.spotify.com https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  Permissions-Policy: geolocation=(), camera=(), microphone=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
```

> `<meta http-equiv="Content-Security-Policy">` works as a fallback but **cannot** set
> `frame-ancestors` (clickjacking protection) — use real headers for that.

---

## 2. Admin session — replace the stored password  (review #4)

Today `admin.html` keeps the raw admin password in `sessionStorage` (`sb_pw`) and replays
it on every call. Any XSS on the admin origin could read it. Recommended:

1. The `login` edge-function action returns a **short-lived signed token** (e.g. a JWT with
   ~30–60 min expiry) instead of the client re-sending the password.
2. Store it in an **HttpOnly, Secure, SameSite=Strict cookie** set by the function so JS
   can't read it. If a cookie isn't workable on the chosen host, keep the token (not the
   password) in memory and re-auth on expiry — never persist the raw password.
3. `save` / `upload` / `list_subs` / `set_password` validate the token server-side.
4. Add basic rate-limiting / lockout on `login`.

Do the in-repo XSS hardening first (done) so a token can't simply be stolen another way.

---

## 3. Supabase backend — commit it  (review #14)

The edge function + schema + policies are the real security boundary but aren't in the
repo, so they can't be reviewed or reproduced. Add:

```
supabase/
  functions/admin/index.ts        # actions: login | save | upload | list_subs | set_password
  migrations/*.sql                # site_content, subscribers, admin_config tables
```

**RLS expectations** (verify against what's deployed):

- `site_content` — anon: `SELECT` only. Writes only via the edge function (service role).
- `subscribers` — anon: `INSERT` only (used by the public join form). **No anon
  `SELECT`** (or the whole list is publicly readable). Admin reads via the edge function.
- `admin_config` — no anon access at all.
- Storage bucket (admin uploads) — public read if assets are public; writes only via the
  edge function / service role.

Document required env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`
hash, etc.) and a deploy command.

> The publishable key in `cms.js` is a read-only/anon key and is safe to ship **only if**
> RLS is correct (esp. no anon `SELECT` on `subscribers`). Confirm this.

---

## 4. Subscriber phone-merge  (review #6, backend half)

`sbSubscribe` posts with `Prefer: resolution=ignore-duplicates`, so a visitor who joins
with email only and later adds a phone never gets the phone saved. Switching to
`resolution=merge-duplicates` (upsert) fixes it **but requires anon `UPDATE` permission**
on `subscribers` (currently insert-only). Safer alternative: handle the merge inside the
edge function so anon keeps insert-only. Decide based on the RLS you commit in §3.
The client already sends `phone: null` when absent — keep that so a later email-only
submit can't clobber a stored phone.
