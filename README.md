# SLIME BY — Official Site

The official website for **Slime By** — Delaware rap. Melody, chaos, motion, green pressure.
A single-page, fully interactive experience: real Web-Audio visualizer, a scroll-tracking
snake, SB Universe lore, music, vault, merch, shows, and contact.

**Stack:** static HTML/CSS/JS — no build step. The page (`index.html`) is data-driven:
it reads its content from Supabase via `cms.js`, and falls back to built-in defaults if
the backend is empty or unreachable, so it always renders. A password-protected admin
page (`admin.html`) lets you edit every section and publish live.

## Features
- **Featured drop / spotlight** — the current release with **smart links** (Spotify /
  Apple / YouTube) and an in-page preview, plus a **next-drop countdown** and a
  **pre-save / notify** card.
- **The Lab** — a **stem player**: a 5-track × 16-step sequencer (808, bass, snare,
  hats, keys) built on the site's Web-Audio engine. Tap a track name to mute, tap the
  cells to flip steps, set the tempo, and run your own slime loop. No audio files needed.
- **Videos** — a grid of clips that open a **YouTube embed** in the lightbox.
- **Live visualizer** — real-time frequency bars/waves driven by the playing track.
- **Music** — release grid with **all / albums / singles** filters, an in-page player
  (play/pause, seek, **volume**), and the live Spotify artist embed.
- **Vault** — click any visual to open a lightbox with a "watch on YouTube" link.
- **Merch** — a **coming soon** teaser; the CTA routes visitors to the slime list
  for first access when the shop drops.
- **Shows** — data-driven list. Empty by default with a "get tour alerts" CTA.
- **Join the slime (email + SMS)** — validates an email plus an optional phone number and
  saves sign-ups to the Supabase `subscribers` table (viewable + exportable in the admin's
  **Audience** tab), with `localStorage` (`sb_list` / `sb_sms`) as an offline fallback.
- **Extras** — scroll-spy nav, back-to-top, share button (Web Share API + clipboard
  fallback), keyboard-shortcut help (`?`), persistent visitor counter, and a
  `type "slime"` easter egg.
- **Accessibility** — skip link, focus outlines, ARIA labels, and full
  `prefers-reduced-motion` support.

## Admin / live editing (CMS) — "SLIME CONTROL"
The site's content lives in **Supabase** and is managed from a password-gated, Shopify-style
admin at `admin.html`.

- **Open** `https://<your-site>/admin.html` and enter the password.
- **Sidebar navigation** — one pane per section (Hero, Drop, Music, About, SB World, Vault,
  Videos, Merch, Shows, Contact, Footer) plus **Audience** and **Settings**.
- **Friendly, labelled forms** — every field has a human label, hint, and the right input:
  URL / email / date-time / colour pickers, dropdowns, rich-text (HTML) areas, image uploads
  with live thumbnails, and on/off toggles. (Labels/types come from `SB_SCHEMA` in `cms.js`.)
- **Live preview** — a real, in-page preview of the site that updates as you type. Toggle
  desktop / phone widths.
- **Repeatable lists** (releases, videos, shows, the five powers, vault items, marquee words,
  badges) support **add, remove, duplicate, and reorder** (move up / down).
- **Safety rails** — unsaved-change tracking with a status pill, a browser "leave?" guard, and
  an automatic local **draft** that offers to restore your work if you close the tab.
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
  Actions: `login`, `save`, `upload` (→ public `media` bucket), `list_subs`, `set_password`.
- **Sign-ups** (`join the slime`) are written to a `subscribers` table via the publishable key —
  RLS allows anonymous **insert only** (no public read), and the admin reads the list through the
  edge function with the service-role key. localStorage stays as an offline fallback.
- To change the password: use **Settings → Change password** (or update `admin_config` directly).
- Note: Supabase's free tier pauses a project after ~1 week of inactivity; if that happens
  the site still renders (from `cms.js` defaults) but published edits won't show until the
  project is resumed.

## Structure
```
index.html                  # the site (HTML + CSS + JS), rendered from CMS content
admin.html                  # password-gated admin / CMS editor
cms.js                       # Supabase config, default content model, read/write helpers
assets/
  man-of-my-word.mp3        # background track (loops)
  my-time-cover.jpg         # My Time cover art
  sb-portrait.jpg           # artist photo (hero + about)
  slime-by.jpg              # vault visual
```

## Customizing content
**The easy way:** use the admin page (`admin.html`) — it edits every section, including
tour dates, releases, the featured drop + countdown date + pre-save link, videos
(YouTube IDs), and the SB Universe "five powers" lore + stats, then publishes live.

**By hand:** the same content model lives in `SB_DEFAULTS` in `cms.js` (these are the
fallback values when nothing is published). Editing it there changes the built-in defaults.
- **Stem player** is interactive, not content — it stays in the `STEMS` array in
  `index.html` (`{n:'NAME', c:'#color', f:()=>sound(), pat:[...16 steps]}`).

## Run locally
Open `index.html` in a browser, or serve it:
```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Deploy to GitHub Pages
1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*,
   Branch = `main`, Folder = `/ (root)`. Save.
3. Live in ~1 min at `https://<your-user>.github.io/<repo>/`.

## Notes
- Audio can't autoplay with sound until a visitor interacts (browser policy); the track
  starts on first click/tap/keypress or any play button.
- Booking email in the contact section (`booking@slimeby.com`) is a placeholder — update
  it in `index.html`.

© 2026 Slime By · 100% Independent · Delaware
