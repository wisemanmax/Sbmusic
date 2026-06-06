# SLIME BY — Official Site

The official website for **Slime By** — Delaware rap. Melody, chaos, motion, green pressure.
A single-page, fully interactive experience: real Web-Audio visualizer, castable slime
enchantments, a scroll-tracking snake, SB Universe lore, music, vault, merch, shows, and contact.

**Stack:** plain HTML/CSS/JS in one file. No build step, no dependencies. Just open `index.html`.

## Features
- **Slime enchantments** — a grimoire of eight castable Web-Audio enchantments
  (venom, ooze, quake, abyss, hiss, mist, fang, curse). Tap them or press the rune key
  (`Q W E R / A S D F`). Charging the **venom meter** triggers full rage mode.
- **Live visualizer** — real-time frequency bars/waves driven by the playing track.
- **Music** — release grid with **all / albums / singles** filters, an in-page player
  (play/pause, seek, **volume**), and the live Spotify artist embed.
- **Vault** — click any visual to open a lightbox with a "watch on YouTube" link.
- **Merch** — a **coming soon** teaser; the CTA routes visitors to the slime list
  for first access when the shop drops.
- **Shows** — data-driven list. Empty by default with a "get tour alerts" CTA.
- **Newsletter** — validates the email and stores sign-ups in `localStorage`.
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
- **Enchantments:** edit the `ENCHANTS` array in `index.html` — each entry is
  `{l:'NAME', k:'KEY', c:'#color', f:()=>sound()}` and renders into `#enchgrid`.

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
