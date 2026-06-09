# SLIME BY — Official Site

The official website for **Slime By** — Delaware rap. Melody, chaos, motion, green pressure.
A **multi-page**, fully interactive experience: real Web-Audio visualizer, a pit of
scroll-tracking snakes, a slowed + reverb studio, SB Universe lore, music, vault, merch,
shows, and contact.

**Stack:** static HTML/CSS/JS — no build step. The site is split into eight linked
pages (`index`, `music`, `lab`, `world`, `quest`, `vault`, `shows`, `connect`). They share one
stylesheet (`assets/styles.css`) and one engine (`assets/app.js`): the engine injects the
shared chrome (navbar, footer, persistent player, modal, overlays…) from a single source
of truth — so the **navbar is identical and all-linking on every page** — and the
background track follows you across navigations (it remembers position, volume, and the
slowed/reverb settings). Each page is data-driven: it reads content from Supabase via
`cms.js`, and falls back to built-in defaults if the backend is empty or unreachable, so it
always renders. A password-protected admin page (`admin.html`) lets you edit every section
and publish live.

## Features
- **Featured drop / spotlight** — the current release with **smart links** (Spotify /
  Apple / YouTube) and an in-page preview, plus a **next-drop countdown** and a
  **pre-save / notify** card.
- **The Lab** — a **slowed + reverb studio** (in the spirit of slowedandreverb.studio):
  bend the song playing across the site in real time with **speed** (pitches the whole
  track down/up), **reverb**, and **room** sliders, plus one-tap presets — *slowed +
  reverb*, *deep slow*, *nightcore*, *original*. Built on the site's Web-Audio engine
  (a `ConvolverNode` for reverb + `playbackRate` with pitch-shift for the slow).
- **Auto-play** — the track starts on page load (falls back to the first interaction if
  the browser blocks it).
- **Rage mode** — a takeover toggle: the snakes turn blood-red and whip faster, the audio
  distorts (no longer sped up), and the screen shakes through a configurable stack of effects
  (fire, glitch, blood drip, TV static, strobes + more). Snake strikes, ember bursts,
  lightning, spark rain and the heartbeat vignette are part of the base vibe and run even
  with rage off.
- **Videos** — a grid of clips that open a **YouTube embed** in the lightbox.
- **Live visualizer** — real-time frequency bars/waves driven by the playing track.
- **Music** — release grid with **all / albums / singles** filters, an in-page player
  (play/pause, seek, **volume**), and the live Spotify artist embed.
- **Vault** — click any visual to open a lightbox with a "watch on YouTube" link.
- **Merch** — an **interactive coming-soon shop**: tilt product cards open a modal with
  a size picker and a per-item **"notify me"** that marks the piece as *watching*
  (persisted to `localStorage`); the main CTA routes visitors to the slime list for first
  access when the shop drops.
- **Shows** — data-driven list. Empty by default with a "get tour alerts" CTA.
- **Join the slime (email + SMS)** — validates an email plus an optional phone number,
  requires an explicit consent opt-in, and saves sign-ups to the Supabase `subscribers`
  table (viewable + exportable in the admin's **Audience** tab). If the backend write
  fails the entry is queued in `localStorage` (`sb_pending`) and retried on the next
  visit, then cleared — personal data isn't kept in a permanent local list.
- **Motion & interaction** — a **slime page-wipe** between pages (armed before first paint
  so there's no flash), a **scroll-progress bar**, pointer-driven **3D tilt** on every
  card, and **magnetic** primary buttons. The pointer effects gracefully fall back on
  touch (`prefers-reduced-motion` too): cards get **press feedback**, the play / enter
  affordances stay visible (no hover to reveal them), and everything else — page wipes,
  the rage toggle, the slowed studio, modals — works the same.
- **Fully mobile** — one collapsible nav (a burger menu that holds the links **and** the
  rage toggle), no grey tap-flash, 16px inputs so iOS doesn't zoom on focus, toasts that
  clear the bottom player, and lighter backdrop blur for smooth scrolling on phones.
- **Extras** — active-page nav, back-to-top, share button (Web Share API + clipboard
  fallback), keyboard-shortcut help (`?`), per-session visitor counter, and a
  `type "slime"` easter egg.
- **Accessibility** — skip link, focus outlines, ARIA labels, a `<noscript>` fallback
  nav, and full `prefers-reduced-motion` support.

## Admin / live editing (CMS) — "SLIME CONTROL"
The site's content lives in **Supabase** and is managed from a password-gated, Shopify-style
admin at `admin.html`.

- **Open** `https://<your-site>/admin.html` and enter the password.
- **Sidebar navigation** — one pane per section (Hero, Drop, Music, About, SB World, Vault,
  Videos, Merch, Shows, Contact, Footer), plus **Page Add-ons**, **Custom Pages**, **Analytics**,
  **Audience** and **Settings**.
- **Page Add-ons** — drop extra content blocks (kicker / heading / text / image / button /
  YouTube embed, in centered / left / card / full-bleed layouts) onto the bottom of *any*
  existing page, no code. Add, remove, duplicate and reorder them like any other list.
- **Custom Pages** — build **brand-new pages** from the admin. Give it a slug + title, add
  blocks, and (optionally) it appears in the top nav automatically. New pages render through
  a shared `page.html` template driven entirely by the published content — nothing to deploy.
- **Smart Links** — a **link-in-bio portal** for the catalog (like Linkfire / Symphony, in SB
  theme). Create a short link from the admin — give it a slug, title, artwork and a button per
  platform (Spotify, Apple, YouTube, SoundCloud, TIDAL, …) — and it lands at
  **`slimeby.com/<slug>`** (e.g. `slimeby.com/slime-love`) on a themed card with one tap to every
  service. Incoming tracking params (`utm_*`, `fbclid`, …) are forwarded to the outbound buttons.
  Every link with *Show on portal* on collects at **`/links`** (the `links.html` hub). Clean URLs
  are served by `404.html`, which routes any unknown path to its matching link (or custom page).
- **Friendly, labelled forms** — every field has a human label, hint, and the right input:
  URL / email / date-time / colour pickers, dropdowns, rich-text (HTML) areas, image uploads
  with live thumbnails, and on/off toggles. (Labels/types come from `SB_SCHEMA` in `cms.js`.)
- **Live preview** — a real, in-page preview of the site that updates as you type. Toggle
  desktop / phone widths.
- **Repeatable lists** (releases, videos, shows, the five powers, vault items, marquee words,
  badges) support **add, remove, duplicate, and reorder** (move up / down).
- **Safety rails** — unsaved-change tracking with a status pill, a browser "leave?" guard, and
  an automatic local **draft** that offers to restore your work if you close the tab.
- **Analytics** — a built-in, Google-Analytics-style dashboard: **who's on the site right now**,
  pageviews, unique visitors, sessions, clicks and new-visitor share over a 7 / 30 / 90-day or
  yearly window, a daily pageviews chart and an **hour-of-day** chart, plus
  **top tracks** (plays + full listens from the site player), **where fans tap out to**
  (Spotify / Apple / YouTube / IG / TikTok outbound clicks), **top pages**, **what people click**,
  **where they leave off** (exit pages), **referrers**, **campaigns** (utm tags / ad-click
  presence), **device / browser / OS** breakdowns, a session **funnel**
  (visited → played → really listened (50%+) → joined the list), and a **site health** card
  (real-user LCP/CLS, lite-mode share *per browser*, perf-governor flips, JS errors in the field).
  First-party and **consent-gated**: a banner asks on first visit and **nothing is tracked until
  the visitor accepts** (decline → no identifier, no events). On accept it collects the usage
  signals above plus device type, browser, OS, a coarse screen bucket, language and timezone —
  but never an IP address, fingerprint, ad-click id value, or third-party/cross-site tag. A public
  `privacy.html` page documents it and lets visitors change their choice (footer links +
  `window.sbConsent`).
- **Audience** — everyone who joined the slime list from the site, with totals and **CSV export**.
- **Settings** — change the admin password, **export / import** your whole content model as JSON,
  and reset to the built-in defaults.
- **Publish** — writes go live for all visitors instantly.

**How it's wired**
- `cms.js` holds the Supabase URL + publishable (read-only) key, the default content model
  (`SB_DEFAULTS`), the admin UI metadata (`SB_SECTIONS`, `SB_SCHEMA`), and the read/write helpers.
- The public site reads content with the publishable key (RLS allows read of `site_content` only).
- Writes go through a Supabase **Edge Function** (`admin`) that checks the password
  **server-side** (stored in a locked-down `admin_config` table, never shipped to the browser).
  Actions: `login`, `save`, `upload` (→ public `media` bucket), `list_subs`, `analytics`, `set_password`.
- **Sign-ups** (`join the slime`) are written to a `subscribers` table via the publishable key —
  RLS allows anonymous **insert only** (no public read), and the admin reads the list through the
  edge function with the service-role key. localStorage stays as an offline fallback.
- **Analytics** are written to an `analytics_events` table via the publishable key — like sign-ups,
  RLS allows anonymous **insert only** (no public read). The admin reads *aggregates* (never raw
  rows) through the edge function's `analytics` action, backed by a service-role-only
  `analytics_summary()` function. Tracking lives in `assets/analytics.js` (auto-loaded by `app.js`);
  it skips the admin page and the editor preview, and **only runs after the visitor accepts the
  consent banner** (the choice is stored in `localStorage` as `sb_consent`).
- To change the password: use **Settings → Change password** (or update `admin_config` directly).
- Note: Supabase's free tier pauses a project after ~1 week of inactivity; if that happens
  the site still renders (from `cms.js` defaults) but published edits won't show until the
  project is resumed.

## Structure
```
index.html                  # Home — hero, marquee, featured drop + countdown
music.html                  # Music — slime player, releases, Spotify embed
lab.html                    # The Lab — slowed + reverb studio + visualizer
world.html                  # SB World — about + the five-powers lore
quest.html                  # Slime the Game — beat-reactive arcade quest (rides the live player)
vault.html                  # Vault — visuals grid + videos
shows.html                  # Shows — tour dates + merch (coming soon)
connect.html                # Tap In — socials, join-the-list, booking
page.html                   # generic template for admin-created Custom Pages (?p=<slug>)
admin.html                  # password-gated admin / CMS editor
cms.js                      # Supabase config, default content model, nav map, helpers
assets/
  styles.css                # all site styles (shared by every page)
  app.js                    # site engine — injects shared chrome + wires every feature
  quest.js                  # "Slime the Game" engine — mounted on quest.html, beats off the live player
  man-of-my-word.mp3        # background track (loops)
  my-time-cover.jpg         # My Time cover art
  sb-portrait.jpg           # artist photo (hero + about)
  slime-by.jpg              # vault visual
```

Every page loads `assets/styles.css`, then `cms.js`, then `assets/app.js`. The navbar,
footer, persistent music player, cursor, snake pit, modal and toasts are **injected by
`app.js`** from one definition (`SB_NAV` in `cms.js`), so adding/renaming a page or nav
link is a one-line change that updates every page at once. Each feature is guarded, so a
page that doesn't include a given section simply skips it.

## Customizing content
**The easy way:** use the admin page (`admin.html`) — it edits every section, including
tour dates, releases, the featured drop + countdown date + pre-save link, videos
(YouTube IDs), and the SB Universe "five powers" lore + stats, then publishes live.

**By hand:** the same content model lives in `SB_DEFAULTS` in `cms.js` (these are the
fallback values when nothing is published). Editing it there changes the built-in defaults.
- **Slowed + reverb studio** is interactive, not content — its presets live in
  `assets/app.js` as `SR_PRESETS` (each is `[speed%, reverb%, room%]`) and it processes the
  background track live through the Web-Audio graph.

## Run locally
Open `index.html` in a browser, or serve the folder (recommended, so page-to-page
links and the admin live-preview behave exactly like production):
```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Tests
```bash
npm install            # dev deps (Playwright)
npm run test:install   # one-time: download the Chromium browser binary
npm test               # node --check on JS, then the Playwright e2e/security suite
```
`npm test` runs the JS syntax checks first (fast, no browser) and then the end-to-end
suite in `tests/e2e.mjs`. The e2e run needs the Chromium binary from `test:install`; CI
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) installs it automatically.

## Security headers
Header/CSP config ships as [`_headers`](_headers) (Netlify / Cloudflare Pages) and
[`vercel.json`](vercel.json). **GitHub Pages ignores both** — front the site with
Cloudflare or host on Netlify/Cloudflare Pages/Vercel for them to apply. See
[`SECURITY.md`](SECURITY.md).

## Deploy to GitHub Pages
1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*,
   Branch = `main`, Folder = `/ (root)`. Save.
3. Live in ~1 min at `https://<your-user>.github.io/<repo>/`.

### Custom domain — `slimeby.com`
The repo ships a [`CNAME`](CNAME) file (`slimeby.com`), so GitHub Pages serves the site
on the apex domain. To finish hooking it up:
1. At your DNS host (registrar or Cloudflare), point the apex `@` record at GitHub Pages
   using **four A records** — `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
   `185.199.111.153` — (and the AAAA equivalents `2606:50c0:8000::153` … `8003::153` for
   IPv6). Add a `www` **CNAME** → `<your-user>.github.io` if you also want `www`.
2. **Settings → Pages → Custom domain**: confirm `slimeby.com`, then tick **Enforce
   HTTPS** once the cert is issued (can take a few minutes to an hour). Every page also
   self-upgrades to HTTPS in the browser (a `<head>` redirect + `upgrade-insecure-requests`
   meta), so plain-HTTP visitors are bounced to `https://` even before that box is ticked —
   but still tick it for the proper server-side 301 + HSTS.
3. If you front the domain with Cloudflare, set SSL/TLS mode to **Full** and either keep
   the apex records **DNS-only** (grey cloud) until GitHub verifies the domain, or use
   Cloudflare's CNAME-flattening to `<your-user>.github.io`.

## Notes
- The background track **auto-plays on load**. Browsers block *audible* autoplay until a
  visitor interacts, so when it's blocked the track starts on the **first** tap / scroll /
  keypress / play button — and that first interaction always resumes the audio context
  (so the visualizer and reverb engage too).
- Booking email in the contact section (`booking@slimeby.com`) is a placeholder — update
  it in `connect.html` (or via the admin's **Contact** tab).
- **Smart-link clean URLs** (`slimeby.com/<slug>`) rely on GitHub Pages serving `404.html`
  for unknown paths; `404.html` reads the path and renders the matching link client-side.
  This needs the custom apex domain (it sets `<base href="/">`). The internal/SPA-smooth form
  `link.html?l=<slug>` always works too. Caveat: because the clean URL is served as a 404 and
  content is loaded from the CMS at runtime, link-preview scrapers (iMessage/Slack/Facebook)
  won't see per-link Open Graph tags — they'll show the generic SB card. The link itself opens
  and renders correctly for real visitors.

© 2026 Slime By · 100% Independent · Delaware
