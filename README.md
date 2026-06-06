# SLIME BY — Official Site

The official website for **Slime By** — Delaware rap. Melody, chaos, motion, green pressure.
A single-page, fully interactive experience: real Web-Audio visualizer, a scroll-tracking
snake, SB Universe lore, music, vault, merch, shows, and contact.

**Stack:** plain HTML/CSS/JS in one file. No build step, no dependencies. Just open `index.html`.

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
- **Join the slime (email + SMS)** — validates an email plus an optional phone number
  and stores sign-ups in `localStorage` (`sb_list` / `sb_sms`). Wire `storeLocal` to a
  real provider (Mailchimp/ConvertKit for email, Community/Twilio for SMS) to go live.
- **Extras** — scroll-spy nav, back-to-top, share button (Web Share API + clipboard
  fallback), keyboard-shortcut help (`?`), persistent visitor counter, and a
  `type "slime"` easter egg.
- **Accessibility** — skip link, focus outlines, ARIA labels, and full
  `prefers-reduced-motion` support.

## Structure
```
index.html                  # the whole site (HTML + CSS + JS)
assets/
  man-of-my-word.mp3        # background track (loops)
  my-time-cover.jpg         # My Time cover art
  sb-portrait.jpg           # artist photo (hero + about)
  slime-by.jpg              # vault visual
```

## Customizing content
- **Add tour dates:** edit the `SHOWS` array in `index.html`, e.g.
  `{date:'JUL 12', venue:'The Queen', city:'Wilmington, DE', url:'https://tickets…'}`.
  The list renders automatically; an empty array shows the "no shows" state.
- **Releases:** each card is an `<a class="rel" data-type="album|single">` in the
  `#mgrid` block — the filter tabs read `data-type`.
- **Featured drop:** edit the `#drop` section (cover, title, smart links) and set
  `DROP_DATE` in `index.html` to your next release date for the countdown. Point the
  `#presaveBtn` link at your pre-save URL (e.g. a DistroKid HyperFollow / Feature.fm link).
- **Videos:** add each clip's YouTube video ID to the `VIDEOS` array in `index.html`
  (`{t,s,img,id}`) — entries with an `id` play in an embedded lightbox.
- **Stem player:** edit the `STEMS` array in `index.html` — each entry is
  `{n:'NAME', c:'#color', f:()=>sound(), pat:[...16 steps]}`.

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
