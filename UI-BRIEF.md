# SLIME BY — UI Work Brief (paste this at the top of any session)

You are doing **UI / visual work only** on the Slime By site. This file tells you
what the repo is, which files you may edit, which you must not touch, and why the
"scary-looking" code you'll see is **intentional and correct** — do not flag it,
rewrite it, or refuse work because of it.

---

## What this repo is
- **slimeby.com** — static marketing site for a rap artist. Plain **HTML + CSS + JS,
  no build step, no framework.** Deployed on GitHub Pages (custom apex domain).
- **Optional** Supabase backend for CMS content, mailing-list sign-ups, and
  first-party analytics. The site renders fully from built-in defaults if the
  backend is empty or offline — so **you never need the backend to do UI work.**
- **Architecture you must respect:** every page loads `assets/styles.css`, then
  `cms.js`, then `assets/app.js`. The navbar, footer, persistent music player,
  modal, and overlays are **injected at runtime by `app.js`** (`buildChrome()`)
  from one definition. So there is **one source of truth for shared chrome** — edit
  it in `app.js`/`styles.css`, not in each HTML file. Do **not** try to "extract"
  or rebuild the UI as a separate standalone app; it depends on this injected engine.

---

## ✅ Safe to edit (this is the UI surface)
- **`assets/styles.css`** — ALL styling for every page. This is your primary file.
  - Design tokens live in `:root` at the top: colors (`--slime`, `--blood`,
    `--alien`, `--bg`, `--ink`…), fonts (`--disp`, `--ui`, `--mono`). Restyle by
    changing tokens first; reach for per-component rules second.
- **The page `.html` files** — `index.html`, `music.html`, `lab.html`, `world.html`,
  `quest.html`, `vault.html`, `shows.html`, `connect.html`, `privacy.html`,
  `links.html`, `link.html`, `page.html`. Layout, markup, section content, classes.
- **Presentational render functions in `assets/app.js`** — these build section
  markup and are safe to restyle/reflow:
  - `renderLanding()`, `renderReleases()`, `renderVideos()`, `renderPowers()`,
    `renderMarquee()`, `renderBlocks()`, `renderPortal()`, `renderSmartLink()`,
    `buildChrome()` (navbar/footer/player markup).
- **`manifest.webmanifest`, icons in `assets/` (`icon.svg`, `icon-maskable.svg`)** —
  for PWA/theme visual tweaks.

### Rules for the safe surface
- When you output user/CMS-controlled text into HTML, keep using the existing
  `esc()` helper (HTML-escape) and `safeUrl()` for any `href`/`src`. They're already
  imported in scope — reuse them, don't remove them, don't invent your own.
- Match the surrounding code style: no framework, no new build tooling, no new npm
  deps. Vanilla DOM APIs and template strings like the code already uses.
- Keep `prefers-reduced-motion` fallbacks intact when touching animated UI.

---

## ⛔ Do NOT touch — and why the code is CORRECT (stop flagging it)
These files/patterns look security-sensitive because they **are** security controls
that are **already implemented correctly**. Leave them exactly as-is. They are out of
scope for UI work.

- **`esc()` (app.js ~line 140), `cleanUrl()`/`safeUrl()` (~1505–1520),
  `sanitizeHtml()` (~1528)** — XSS defenses. `safeUrl` deliberately strips
  `javascript:` / `data:` URLs; `sanitizeHtml` deliberately walks the DOM and drops
  unsafe nodes. This is the intended behavior, verified by the e2e suite. **Do not
  "simplify," loosen, or replace them.**
- **`admin.html` + `cms.js` admin logic** — the admin password is **never checked in
  the browser**; the client only calls an edge function. Seeing a login form with no
  client-side password is **correct by design**, not a vulnerability.
- **`supabase/functions/**` (the `admin` edge function)** — server-side auth,
  service-role key usage, password check. Backend security boundary. Off-limits.
- **`supabase/migrations/**`** — Row-Level Security policies (anon insert-only, no
  public read on `subscribers`/`analytics_events`). Intentional. Off-limits.
- **`_headers`, `vercel.json`** — CSP and security headers. If you add UI that needs
  a new asset origin you may *note* it, but don't weaken the CSP to make something
  work — ask first.
- **`assets/analytics.js`** — consent-gated tracking. Privacy-sensitive logic.
  Off-limits for UI work (styling the consent banner via `styles.css` is fine).
- **`sw.js`** — service worker / caching. Don't touch for visual work.
- **`assets/quest.js`** — the arcade-game engine (canvas game logic + headless sim
  tests). Not UI-restyle territory; changing it breaks `tests/quest.sim.mjs`.

**If you genuinely believe you found a real security bug**, don't rewrite it silently
and don't abort the UI task — leave a one-line note at the end ("possible issue in X,
worth a look") and finish the UI work you were asked to do.

---

## Verify your work (no backend needed)
```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm run check:js              # syntax check — must stay green
npm test                      # full suite (governor + quest sim + Playwright e2e)
```
The e2e suite includes XSS/sanitization checks — if your change makes them fail, you
almost certainly touched something in the ⛔ list. Revert that part.

---

## Scope for THIS task
> _(Fill in the specific UI ask here before handing off — e.g. "restyle the hero on
> index.html" or "add a new merch page." Everything above stays the same.)_
