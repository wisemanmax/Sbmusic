/* ============================================================
   SLIME BY — CMS layer (shared by index.html + admin.html)
   Content lives in Supabase; the public site reads it, the
   admin page writes it through a password-checked edge function.
   ============================================================ */
const SB_CFG = {
  url: 'https://rccwnyghfiinpoexvtwp.supabase.co',
  key: 'sb_publishable_GScj7y6l3W4Lh3oWRYaJHg_xG-8WPbP', // publishable (read-only) key — safe to ship
};
window.SB_CFG = SB_CFG;

/* ---- DEFAULT CONTENT ----
   This mirrors the built-in site. If Supabase is empty or unreachable,
   the site renders from this, so it never breaks. The admin page edits
   a copy of this and publishes the result. */
const SB_DEFAULTS = {
  hero: {
    title: 'SLIME BY',
    sub: 'delaware rage · green pressure · venom',
  },
  marquee: ['SLIME SZN', 'VENOM', 'SNAKE PIT', '★ MAN OF MY WORD', '100% INDEPENDENT', 'SB UNIVERSE'],
  drop: {
    kicker: '✦ the drop',
    heading: 'out <em>now</em>',
    featuredTitle: 'My Time',
    featuredSub: 'album · the slime in full bloom',
    cover: 'assets/my-time-cover.jpg',
    spotify: 'https://open.spotify.com/album/5RickWrPNRszADHSzJJYUc',
    apple: 'https://music.apple.com/us/artist/slime-by/1542729349',
    youtube: 'https://youtube.com/@slimeby_',
    presaveUrl: 'https://open.spotify.com/artist/70LnkJjJc5yq650kELO09A',
    dropDate: '2026-07-04T00:00:00',
  },
  music: {
    playerTitle: 'Man Of My Word',
    playerCover: 'assets/my-time-cover.jpg',
    spotifyArtistId: '70LnkJjJc5yq650kELO09A',
    releases: [
      { title: 'My Time', sub: 'album · 2024', type: 'album', img: 'assets/my-time-cover.jpg', url: 'https://open.spotify.com/album/5RickWrPNRszADHSzJJYUc' },
      { title: 'Save Her', sub: 'single · 2024', type: 'single', img: 'https://i.scdn.co/image/ab67616d00001e028a915904da619cc9a6ee6fc5', url: 'https://open.spotify.com/album/6T2tcMpvYytltsEjPgyhEw' },
      { title: 'Flip', sub: 'single · 2023', type: 'single', img: 'https://i.scdn.co/image/ab67616d00001e02999c0b302ffd8ac36402327a', url: 'https://open.spotify.com/album/5zZBRNMJqFr6hBpB6cjfyI' },
      { title: 'Turn This Up', sub: 'single · 2023', type: 'single', img: 'https://i.scdn.co/image/ab67616d00001e02999c0b302ffd8ac36402327a', url: 'https://open.spotify.com/album/2yiGZO9RmY8ql8h1OtManp' },
      { title: "I'm In Yo City", sub: 'single · 2021', type: 'single', img: 'https://i.scdn.co/image/ab67616d00001e028a915904da619cc9a6ee6fc5', url: 'https://open.spotify.com/album/358k4SFDwfF02ln2L4ZIg5' },
      { title: 'Flava', sub: 'apple music', type: 'single', img: 'assets/sb-portrait.jpg', url: 'https://music.apple.com/us/artist/slime-by/1542729349' },
    ],
  },
  about: {
    lead: 'melody, chaos, motion & green pressure',
    text: 'Slime By is a Delaware artist building a world around melody, chaos, motion, and green pressure. The sound moves between rage, luxury, pain, and flex. Every drop is part of the SB universe.',
    portrait: 'assets/sb-portrait.jpg',
    badge: '☠ SB · DE',
    stats: [
      { n: '5+', l: 'releases' },
      { n: 'SB', l: 'the world' },
      { n: '100%', l: 'independent' },
    ],
  },
  universe: {
    hint: '↳ tap a force to enter the lore',
    powers: [
      { id: '01', n: 'the sound', c: '#8dff2b', tag: 'melody × chaos', short: "melody welded to chaos. hooks that set like resin and don't let go.", lore: 'Melody welded to chaos. Hooks that set like resin and don’t let go. The sound is the first law of the SB world — every other force is built on top of the frequency.', stats: [['melody', 82], ['chaos', 76], ['pressure', 68]] },
      { id: '02', n: 'the slime', c: '#b6ff5a', tag: 'the texture', short: 'wet, glossy, dangerous — the texture coating everything SB touches.', lore: 'Wet, glossy, dangerous — the green coating every surface SB touches. The slime spreads on contact. Once it’s on you, you’re part of the world.', stats: [['spread', 90], ['shine', 74], ['venom', 80]] },
      { id: '03', n: 'the snake', c: '#9b3cff', tag: 'the guide', short: 'quiet, patient, lethal. movement you feel before you ever see it.', lore: 'Quiet, patient, lethal. Movement you feel before you ever see it. The snake is SB’s avatar — it follows you through the whole site, and through the whole story.', stats: [['patience', 88], ['strike', 92], ['stealth', 70]] },
      { id: '04', n: 'the motion', c: '#c47bff', tag: 'never static', short: 'never static. the world bends, drips, and keeps moving forward.', lore: 'Never static. The world bends, drips, and keeps moving forward. Stand still in the SB universe and the slime catches up to you.', stats: [['momentum', 86], ['flux', 79], ['drive', 84]] },
      { id: '05', n: 'the pressure', c: '#ff1f2e', tag: 'green pressure', short: 'green pressure. diamonds or dust — there is no in between.', lore: 'Green pressure. Diamonds or dust — there is no in between. The pressure is what turns the sound into something permanent.', stats: [['intensity', 94], ['weight', 81], ['heat', 77]] },
    ],
  },
  vault: {
    youtube: 'https://youtube.com/@slimeby_',
    items: [
      { title: 'Man Of My Word', sub: 'official visual', img: 'assets/sb-portrait.jpg', href: 'https://youtube.com/@slimeby_' },
      { title: 'My Time', sub: 'visualizer', img: 'assets/my-time-cover.jpg', href: 'https://youtube.com/@slimeby_' },
      { title: 'Slime Szn', sub: 'teaser · SB', img: 'assets/slime-by.jpg', href: 'https://youtube.com/@slimeby_' },
      { title: 'Behind The Slime', sub: 'vault · SB', img: 'assets/sb-portrait.jpg', href: 'https://youtube.com/@slimeby_' },
    ],
  },
  videos: [
    { t: 'Man Of My Word', s: 'official video', img: 'assets/sb-portrait.jpg', id: '' },
    { t: 'My Time', s: 'visualizer', img: 'assets/my-time-cover.jpg', id: '' },
    { t: 'Slime Szn', s: 'teaser · SB', img: 'assets/slime-by.jpg', id: '' },
  ],
  merch: {
    kicker: 'slime shop',
    heading: 'merch <em>coming soon</em>',
    text: 'the slime shop is still in the lab. hoodies, tees, vamp masks and iced SB chains — all dropping soon. no price tags yet, just 🐍 where the numbers go.',
    button: '☠ get the drop alert',
  },
  shows: [],
  contact: {
    heading: 'TAP IN',
    spotify: 'https://open.spotify.com/artist/70LnkJjJc5yq650kELO09A',
    apple: 'https://music.apple.com/us/artist/slime-by/1542729349',
    youtube: 'https://youtube.com/@slimeby_',
    instagram: 'https://instagram.com/slimeby_sb',
    tiktok: 'https://www.tiktok.com/@slimeby_sb',
    bookingEmail: 'booking@slimeby.com',
    joinTitle: 'join the slime ☠',
    joinSub: 'first access to drops, merch & shows — email for news, phone for SMS alerts',
  },
  footer: {
    badges: ['★ BEST VIEWED IN RAGE MODE', 'MADE IN DE', '100% INDEPENDENT', 'SB UNIVERSE ☠'],
    copy: '© 2026 slime by · delaware · the snake moves',
  },
};
window.SB_DEFAULTS = SB_DEFAULTS;

/* Blank-item templates so the admin "add" buttons create proper rows. Keyed by
   the array's dotted path (indices stripped). */
const SB_TEMPLATES = {
  'marquee': 'NEW WORD',
  'footer.badges': 'NEW BADGE',
  'music.releases': { title: '', sub: 'single · 2025', type: 'single', img: '', url: '' },
  'about.stats': { n: '', l: '' },
  'universe.powers': { id: '00', n: 'new force', c: '#8dff2b', tag: '', short: '', lore: '', stats: [['power', 50]] },
  'universe.powers.stats': ['power', 50],
  'vault.items': { title: '', sub: '', img: '', href: '' },
  'videos': { t: '', s: '', img: '', id: '' },
  'shows': { date: '', venue: '', city: '', url: '' },
};
window.SB_TEMPLATES = SB_TEMPLATES;

/* ---- helpers ---- */
function sbIsObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
/* deep-merge `over` onto `base`; arrays & primitives in `over` win wholesale */
function sbMerge(base, over) {
  if (over === undefined) return base;
  if (!sbIsObj(base) || !sbIsObj(over)) return over;
  const out = { ...base };
  for (const k in over) out[k] = sbIsObj(base[k]) && sbIsObj(over[k]) ? sbMerge(base[k], over[k]) : over[k];
  return out;
}
window.sbMerge = sbMerge;
function sbClone(x) { return JSON.parse(JSON.stringify(x)); }
window.sbClone = sbClone;

/* read merged content (defaults + whatever's published) */
async function sbGetContent() {
  try {
    const r = await fetch(SB_CFG.url + '/rest/v1/site_content?id=eq.1&select=data', {
      headers: { apikey: SB_CFG.key, Authorization: 'Bearer ' + SB_CFG.key },
    });
    if (!r.ok) throw new Error('read ' + r.status);
    const rows = await r.json();
    const remote = (rows && rows[0] && rows[0].data) || {};
    return sbMerge(SB_DEFAULTS, remote);
  } catch (e) {
    return SB_DEFAULTS;
  }
}
window.sbGetContent = sbGetContent;

/* call the password-checked edge function: actions = login | save | upload */
async function sbAdmin(password, action, payload) {
  const r = await fetch(SB_CFG.url + '/functions/v1/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SB_CFG.key, Authorization: 'Bearer ' + SB_CFG.key },
    body: JSON.stringify({ password, action, payload }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}
window.sbAdmin = sbAdmin;
