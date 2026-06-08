# Cloudflare (free plan) in front of GitHub Pages

This sets up **Cloudflare's free tier as a reverse proxy / CDN in front of the existing
GitHub Pages site** for `slimeby.com`. GitHub Pages stays the host; Cloudflare adds a global
CDN + caching, DDoS protection, an edge TLS cert, edge HTTPS redirects, and — the part that
matters most for this repo — the **security headers**, which GitHub Pages can't serve.

> **The one thing to understand first.** The repo's [`_headers`](_headers) file is only read
> by Cloudflare **Pages** / Netlify. It is **not** read by Cloudflare sitting *in front of*
> another origin, and GitHub Pages ignores it too. So behind this proxy the headers come from
> a Cloudflare **Response Header Transform Rule** instead (Step 7). The header *values* are
> still owned by [`vercel.json`](vercel.json) — the helper script derives the rule from it so
> the two can't drift.

Everything below is a one-time setup in the Cloudflare dashboard + your registrar. Nothing in
this repo needs to change to go live; `CNAME`, `_headers`, and `vercel.json` all stay as-is.

---

## Before you start
- You can log in to the domain **registrar** for `slimeby.com` (to change nameservers).
- The site already works on GitHub Pages at `https://slimeby.com` (custom domain set under
  **Settings → Pages**, `CNAME` file present — it is).
- A free Cloudflare account.

Throughout, replace `wisemanmax` if the GitHub Pages user/org ever differs from
`wisemanmax.github.io`.

---

## Step 1 — Add the site to Cloudflare (Free plan)
1. Cloudflare dashboard → **Add a site** → enter `slimeby.com`.
2. Choose the **Free** plan.
3. Cloudflare scans existing DNS and shows you **two nameservers** (e.g.
   `xxx.ns.cloudflare.com`). Keep that tab open for Step 2.

## Step 2 — Delegate DNS to Cloudflare
At your registrar, replace the domain's nameservers with the two Cloudflare gave you.
Propagation is usually minutes but can take a few hours; Cloudflare emails you when the zone
is **Active**. (Until it's Active, the steps below won't take effect.)

## Step 3 — DNS records — proxy **OFF** for now (grey cloud)
In Cloudflare → **DNS → Records**, make sure these exist. **Set Proxy status to "DNS only"
(grey cloud) for now** — see Step 4 for why.

| Type  | Name           | Content                  | Proxy (for now) |
|-------|----------------|--------------------------|-----------------|
| A     | `slimeby.com`  | `185.199.108.153`        | DNS only (grey) |
| A     | `slimeby.com`  | `185.199.109.153`        | DNS only (grey) |
| A     | `slimeby.com`  | `185.199.110.153`        | DNS only (grey) |
| A     | `slimeby.com`  | `185.199.111.153`        | DNS only (grey) |
| AAAA  | `slimeby.com`  | `2606:50c0:8000::153`    | DNS only (grey) |
| AAAA  | `slimeby.com`  | `2606:50c0:8001::153`    | DNS only (grey) |
| AAAA  | `slimeby.com`  | `2606:50c0:8002::153`    | DNS only (grey) |
| AAAA  | `slimeby.com`  | `2606:50c0:8003::153`    | DNS only (grey) |
| CNAME | `www`          | `wisemanmax.github.io`   | DNS only (grey) |

These are GitHub Pages' apex IPs. Remove any old A/AAAA/ALIAS records that point elsewhere.

- **Apex alternative:** instead of the four A + four AAAA records you may use a single
  `CNAME` at the apex (`slimeby.com → wisemanmax.github.io`); Cloudflare flattens it. The A/AAAA
  set above matches GitHub's own guidance, so it's the default here.
- **Domain-takeover hardening (recommended):** GitHub → **Settings → Pages → Verify domains**
  gives you a `TXT` record like `_github-pages-challenge-wisemanmax` with a token. Add it in
  Cloudflare DNS (DNS only) and click Verify. This stops anyone else from claiming the domain
  on Pages.

## Step 4 — Let GitHub Pages issue its HTTPS cert (still grey cloud)
GitHub provisions a Let's Encrypt cert by reaching the domain directly. If Cloudflare is
**proxying** (orange) before that cert exists, the challenge can fail and GitHub shows
"certificate not yet created" / "DNS check unsuccessful". So with the records **grey** from
Step 3:
1. GitHub → **Settings → Pages**: confirm the custom domain is `slimeby.com` and wait for the
   green check + "certificate issued" (minutes to ~an hour).
2. Tick **Enforce HTTPS**.

Once Enforce HTTPS is on and the cert is issued, continue.

## Step 5 — TLS settings (SSL/TLS)
- **SSL/TLS → Overview → encryption mode: `Full (strict)`.** GitHub Pages presents a valid
  cert for `slimeby.com`, so strict works and is the most secure. *(If you ever see error 526,
  drop to `Full` temporarily.)*
  - **Never use `Flexible`.** With GitHub's Enforce HTTPS on, Flexible makes the origin 301 to
    HTTPS while Cloudflare talks to it over HTTP → an infinite redirect loop
    (`ERR_TOO_MANY_REDIRECTS`).
- **SSL/TLS → Edge Certificates:**
  - **Always Use HTTPS: On** (edge 301 from `http://` → `https://`).
  - **Automatic HTTPS Rewrites: On.**
  - **Minimum TLS Version: 1.2** (optional, recommended).
  - HSTS is already sent as a header in Step 7 (`max-age=63072000; includeSubDomains; preload`),
    so you do **not** need to also enable Cloudflare's HSTS toggle. (Submitting the domain to the
    browser preload list at hstspreload.org is a separate, hard-to-undo opt-in — the `preload`
    directive just makes the site *eligible*.)

## Step 6 — Turn the proxy ON (orange cloud)
Back in **DNS → Records**, flip the four A, four AAAA, and the `www` CNAME to **Proxied
(orange cloud)**. Leave the GitHub-challenge `TXT` as DNS only. Traffic now flows through
Cloudflare's CDN.

## Step 7 — Security headers (the `_headers` replacement)
GitHub Pages won't send the CSP/security headers and `_headers` isn't read through the proxy,
so add them as a **Response Header Transform Rule**. Two ways — both produce the same rule,
both are free:

### Option A — script (recommended; stays in sync with `vercel.json`)
```bash
# Preview the exact rule (no token needed):
npm run cf:headers            # = node cloudflare/apply-headers.mjs --dry-run

# Apply it via the Cloudflare API:
export CF_API_TOKEN=...        # API token with "Zone → Transform Rules → Edit" on this zone
export CF_ZONE_ID=...          # Cloudflare → slimeby.com → Overview (right-hand API panel)
node cloudflare/apply-headers.mjs
```
Create the token at **My Profile → API Tokens → Create Token** (a custom token scoped to
*Zone › Transform Rules › Edit* for `slimeby.com` is enough). The script reads the header set
from [`vercel.json`](vercel.json) and writes the response-header ruleset, so re-running it after
a CSP change re-syncs Cloudflare.

### Option B — dashboard (manual)
**Rules → Transform Rules → Modify Response Header → Create rule.** Run
`npm run cf:headers` first; it prints each rule's match condition and the exact
`Header: value` lines to paste. The set it produces (sourced from `vercel.json`):

- **For all responses** — `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: geolocation=(), camera=(), microphone=()`,
  `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- **For requests where path ends with `.mp3`** — `Content-Disposition: inline`,
  `X-Robots-Tag: noindex, nofollow` (so the catalog plays inline and isn't indexed).

## Step 8 — Caching (optional)
Cloudflare already caches static assets (css/js/images/mp3) by default. To give the audio a
long edge/browser cache, add **Rules → Cache Rules**: *When* `URI Path starts with /assets/`
→ *Eligible for cache*, **Edge TTL** and **Browser TTL** = e.g. 1 year. Leave HTML on default
so CMS-driven content (fetched client-side from Supabase) stays fresh.

---

## Verify
After DNS is Active and the proxy is on:
```bash
# Cloudflare is in front (expect "server: cloudflare" + the headers):
curl -sI https://slimeby.com | grep -i -E 'server|content-security-policy|strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy'

# http → https edge redirect:
curl -sI http://slimeby.com | grep -i -E 'location|HTTP/'

# mp3 path headers:
curl -sI "https://slimeby.com/assets/man-of-my-word.mp3" | grep -i -E 'content-disposition|x-robots-tag'
```
You should see `server: cloudflare`, a single `Content-Security-Policy` header (no duplicates),
and the `http://` request 301-ing to `https://`. Also load the site and check the browser
console for **no CSP violations** (fonts, the Spotify/YouTube embeds, and the Supabase calls
must all still work — a wrong CSP breaks those silently).

## Keeping headers in sync
The CSP/header values live in **one place**, [`vercel.json`](vercel.json) (mirrored by
[`_headers`](_headers) for any Pages/Netlify deploy). When you change them, re-run
`node cloudflare/apply-headers.mjs` to push the same set to Cloudflare. Don't hand-edit the
header values in the Cloudflare dashboard — they'll drift.

## Troubleshooting
| Symptom | Likely cause / fix |
|---|---|
| `ERR_TOO_MANY_REDIRECTS` | SSL/TLS mode is **Flexible** while GitHub Enforce HTTPS is on. Switch to **Full (strict)**. |
| GitHub Pages "certificate not yet created" / "DNS check unsuccessful" | You proxied (orange) before the cert was issued. Set the apex + www back to **DNS only** (grey), wait for the cert + Enforce HTTPS, then re-proxy (Steps 4→6). |
| Error **526** (invalid SSL cert) | Origin cert not valid yet for strict. Use **Full** until GitHub's cert is issued, then move to **Full (strict)**. |
| Error **522/523** | Origin unreachable — usually transient or a stray DNS record. Confirm the apex A/AAAA records match Step 3. |
| Headers missing in `curl` | Transform Rule not created/enabled, or you're hitting a grey-cloud record (no proxy). Re-check Steps 6–7. |
| Two `Content-Security-Policy` headers | You set it both in the Transform Rule *and* a Cloudflare managed/HSTS toggle. Keep only the Transform Rule (Step 7). |

## What this does **not** change
- The repo stays the source of truth and keeps deploying to GitHub Pages on push.
- `CNAME`, `_headers`, and `vercel.json` are unchanged (they're harmless here and `vercel.json`
  is what the header script reads).
- The in-page HTTPS upgrade (`upgrade-insecure-requests` meta + head redirect) still works as a
  belt-and-suspenders alongside Cloudflare's edge redirect.
