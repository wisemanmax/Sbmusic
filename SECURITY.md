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

> **Now shipped in-repo:** [`_headers`](_headers) (Netlify / Cloudflare Pages) and
> [`vercel.json`](vercel.json) carry the header set below. **GitHub Pages ignores both** —
> if production is bare GitHub Pages these headers are NOT active. Front the site with
> Cloudflare (add the headers as a Transform Rule / Workers) or host on
> Netlify / Cloudflare Pages / Vercel for them to take effect. **Fronting GitHub Pages with
> Cloudflare's free plan is documented end-to-end in [`CLOUDFLARE.md`](CLOUDFLARE.md)** —
> including a `cloudflare/apply-headers.mjs` helper that turns the set below into the
> Transform Rule (sourced from `vercel.json`, so it can't drift).
>
> **HTTPS is also enforced in-page** so it holds even on bare GitHub Pages: every `*.html`
> carries `<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">`
> plus a top-of-`<head>` redirect that sends any `http://` load to `https://` (`localhost` /
> `127.0.0.1` / `::1` are exempt for local dev). That upgrades mixed-content subresources and
> bounces plain-HTTP visitors even when the host-level HSTS header above is inactive. It is
> **not** a substitute for ticking **Settings → Pages → Enforce HTTPS** (a server-side 301
> issued before any byte loads, plus real HSTS) — keep both.
>
> `script-src` includes `https://www.youtube.com` for the background-radio IFrame API.

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
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' blob:; connect-src 'self' https://rccwnyghfiinpoexvtwp.supabase.co; frame-src https://open.spotify.com https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests
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
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' blob:; connect-src 'self' https://rccwnyghfiinpoexvtwp.supabase.co; frame-src https://open.spotify.com https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests" },
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
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' blob:; connect-src 'self' https://rccwnyghfiinpoexvtwp.supabase.co; frame-src https://open.spotify.com https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  Permissions-Policy: geolocation=(), camera=(), microphone=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
```

> `<meta http-equiv="Content-Security-Policy">` works as a fallback but **cannot** set
> `frame-ancestors` (clickjacking protection) — use real headers for that.

---

## 2. Admin session token  (review #4 — implemented)

The raw password is **no longer stored client-side**. `login` verifies the password once
and returns a short-lived **HMAC-signed token** (8h, signed with a key derived from the
service-role key); the client keeps the *token* in `sessionStorage` and sends it on every
other call. Old `sb_pw` sessions are migrated to a token on next load and the stored
password is deleted. The function still accepts the password as a fallback, so an expired
token can never lock the admin out. Source: [`supabase/functions/admin/index.ts`](supabase/functions/admin/index.ts).

Remaining (recommended, see the function README):
1. **Hash** the password in `admin_config` (currently plaintext) — `set_password` writes a
   hash, `login` compares it.
2. Move the token into an **HttpOnly, Secure, SameSite cookie** if the admin is served
   same-site with the function (so page JS can't read it at all).
3. Rate-limit / lockout on `login`.

---

## 3. Supabase backend  (review #14)

The schema + RLS are now committed under [`supabase/`](supabase/) (`config.toml`,
`migrations/`), matching the live project `slime-by-cms` (`rccwnyghfiinpoexvtwp`).

**RLS — verified against the live project (good):**

- `site_content` — anon `SELECT` only (`USING true`); writes via the edge function.
- `subscribers` — anon `INSERT` only, **no `SELECT`** → the list is **not** publicly
  readable. The insert is now constrained to a plausible email (was `WITH CHECK (true)`).
- `admin_config` — RLS on, **no policies** → unreachable by the anon key (service role
  only). The remaining `rls_enabled_no_policy` advisory on it is INFO and intentional.
- storage bucket `media` — public read by URL; **public listing disabled** (was a WARN).

Applied via MCP this round: `20260607230350_harden_media_storage_listing`,
`20260607230428_constrain_subscriber_inserts`. After these, `get_advisors(security)`
returns only the intended `admin_config` INFO.

The **`admin` edge function source is now committed** at
[`supabase/functions/admin/index.ts`](supabase/functions/admin/index.ts) (deployed v3,
`verify_jwt = false`). Env it relies on: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
(both injected by Supabase) and the admin password row in `admin_config`. Redeploy with:

```
supabase functions deploy admin --no-verify-jwt
```

> The publishable key in `cms.js` is the anon key. It's safe to ship because RLS is
> correct — confirmed this session: no anon `SELECT` on `subscribers`, `admin_config`
> locked, `site_content` read-only for anon.

---

## 4. Subscriber phone-merge  (review #6, backend half)

`sbSubscribe` does a plain `INSERT` and treats a duplicate (HTTP 409) as "already
subscribed". A visitor who joins with email only and later adds a phone therefore won't get
the phone saved (the second submit just 409s). Anon is (correctly) INSERT-only on
`subscribers` with **no SELECT** policy, so the client **cannot** upsert — an
`ON CONFLICT` upsert would need the proposed row to be visible and gets rejected by RLS
(see §5). Do the email→phone merge **inside the `admin` edge function** (service role),
keyed on `email`, when capturing sign-ups. The client already sends `phone: null` when
absent, so a later email-only submit won't clobber a stored phone.

---

## 5. Sign-ups silently dropped via `ON CONFLICT` + RLS  (fixed)

`sbSubscribe` used to post to `?on_conflict=email` with
`Prefer: resolution=ignore-duplicates`, making PostgREST emit
`INSERT ... ON CONFLICT (email) DO NOTHING`. That speculative-insert path needs the proposed
row to be visible to the caller, but `anon` has **no SELECT policy** on `subscribers` (by
design — the list must not be readable with the public key). Postgres rejected every sign-up
with `42501 "new row violates row-level security policy"`, the client saw a non-2xx and
queued each one under `localStorage.sb_pending` forever, so **nothing reached the table**.
Adding the unique index alone did not help — the `ON CONFLICT` path itself is what RLS
rejects. Fix: the client now does a plain `INSERT` (passes the INSERT `WITH CHECK` policy)
and relies on the `unique(email)` index to dedupe, treating the resulting 409 as success.
