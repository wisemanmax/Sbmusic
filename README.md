# SLIME BY — Official Site

The official website for **Slime By** — Delaware rap. Melody, chaos, motion, green pressure.
Single-page interactive site: real Web-Audio visualizer, slime cursor trail, mouse-reactive hero,
SB Universe lore, music, vault, merch, and contact.

**Stack:** plain HTML/CSS/JS. No build step. Just open `index.html`.

## Structure
```
index.html                  # the whole site
assets/
  man-of-my-word.mp3        # background track (loops)
  my-time-cover.jpg         # My Time cover art
  slime-by.jpg              # artist photo
```

## Run locally
Open `index.html` in a browser, or serve it:
```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Deploy to GitHub Pages
1. Push this repo to GitHub (see below).
2. Repo **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*,
   Branch = `main`, Folder = `/ (root)`. Save.
3. Live in ~1 min at `https://<your-user>.github.io/<repo>/`.

## Notes
- Audio can't autoplay with sound until a visitor interacts (browser policy); the track
  starts on first click/tap/scroll or any play button.
- TikTok handle and booking email in the footer are placeholders — update in `index.html`.

© 2026 Slime By · 100% Independent · Delaware
