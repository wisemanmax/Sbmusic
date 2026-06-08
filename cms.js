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
    sub: 'delaware rage · <b>green pressure</b> · <i>venom</i>',
    bg: 'assets/sb-portrait.jpg',
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
    /* The player is a live tracklist — the now-playing label always reflects the loaded song,
       so there's no fixed-title override anymore (it used to pin every page to one name). */
    playerCover: 'assets/my-time-cover.jpg',
    spotifyArtistId: '70LnkJjJc5yq650kELO09A',
    /* Background "radio": the signature track plays first, then the visitor can skip
       (⏭) into this YouTube playlist — extra songs that keep the site alive. */
    bgPlaylist: 'PLg9MBVDt3XDq6n2jgBpTO5S7wwz2kihSA',
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
    lead: 'melody, chaos, <em>motion</em> & green pressure',
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
    tiktok: 'https://www.tiktok.com/@_slimeby',
    bookingEmail: 'booking@slimeby.com',
    joinTitle: 'join the slime ☠',
    joinSub: 'first access to drops, merch & shows — email for news, phone for SMS alerts',
  },
  footer: {
    badges: ['★ BEST VIEWED IN RAGE MODE', 'MADE IN DE', '100% INDEPENDENT', 'SB UNIVERSE ☠'],
    copy: '© 2026 slime by · delaware · the snake moves',
  },
  /* RAGE MODE effects — flip any of these on/off from the admin "Rage Mode" panel.
     The public site reads them when the ☠ rage button is hit. Everything respects the
     visitor's "reduce motion" setting regardless. */
  rageFx: {
    shake: true,        // the whole screen judders
    redOverlay: true,   // venom-red scanline + vignette wash
    distortAudio: true, // the track gets driven / distorted
    snakeLunge: true,   // the snakes strike on the beat
    emberBursts: true,  // bursts of red embers
    strobe: true,       // hard red strobe flashes
    lightning: true,    // jagged lightning bolts crack across the screen
    heartbeat: true,    // pulsing red vignette like a racing heartbeat
    sparkRain: false,   // sparks rain down from the top
    fire: false,        // flames lick up from the bottom edge
    glitch: false,      // RGB-split / datamosh glitch bursts
    bloodDrip: false,   // blood drips down from the top of the screen
    static: false,      // TV-static noise flicker over everything
  },
  /* Extra info blocks for the landing (home) page — an intro band, a stat strip and a
     "tap in" call-to-action. Each can be hidden with its `show` toggle. */
  landing: {
    intro: {
      show: true,
      kicker: '☠ who is sb',
      heading: 'the <em>snake</em> behind the slime',
      text: 'Slime By is a Delaware artist turning melody, chaos and green pressure into a whole world. Rage, luxury, pain and flex — every drop is another chapter of the SB universe. 100% independent, moving non-stop.',
      image: 'assets/sb-portrait.jpg',
      buttonLabel: 'enter the world →',
      buttonUrl: 'world.html',
    },
    stats: [
      { n: '5+', l: 'releases' },
      { n: '100%', l: 'independent' },
      { n: 'DE', l: 'delaware made' },
      { n: 'SB', l: 'the universe' },
    ],
    cta: {
      show: true,
      kicker: '✦ tap in',
      heading: 'join the <em>slime</em>',
      text: 'first access to drops, merch and shows. follow the snake on every platform and get on the list.',
      buttonLabel: '☠ tap in',
      buttonUrl: 'connect.html',
    },
  },
  /* Extra content blocks appended to the bottom of an existing built-in page.
     Each block picks which page it lands on. Edited in admin → "Page Add-ons". */
  extras: [],
  /* Brand-new pages created from the admin. Each renders through page.html and
     (when nav:true) shows up in the top navigation automatically. */
  pages: [],
  /* Smart links (link-in-bio). Each is a short URL — slimeby.com/<slug> — that
     lands on a themed page with a button per platform, and (when portal:true)
     collects on the /links portal. Edited in admin → "Smart Links". */
  links: [],
};
window.SB_DEFAULTS = SB_DEFAULTS;

/* Platform metadata for smart-link buttons: display name + which themed button
   class to paint it (slime / blood / alien). Shared by the admin select and the
   public renderer so they never drift. `custom` is the catch-all. */
const SB_PLATFORMS = {
  spotify:      { name: 'Spotify',       cls: 'bSlime' },
  apple:        { name: 'Apple Music',   cls: 'bBlood' },
  itunes:       { name: 'iTunes',        cls: 'bBlood' },
  youtube:      { name: 'YouTube',       cls: 'bAlien' },
  youtubeMusic: { name: 'YouTube Music', cls: 'bAlien' },
  soundcloud:   { name: 'SoundCloud',    cls: 'bBlood' },
  tidal:        { name: 'TIDAL',         cls: 'bAlien' },
  amazonMusic:  { name: 'Amazon Music',  cls: 'bSlime' },
  deezer:       { name: 'Deezer',        cls: 'bSlime' },
  audiomack:    { name: 'Audiomack',     cls: 'bSlime' },
  pandora:      { name: 'Pandora',       cls: 'bBlood' },
  bandcamp:     { name: 'Bandcamp',      cls: 'bAlien' },
  instagram:    { name: 'Instagram',     cls: 'bSlime' },
  tiktok:       { name: 'TikTok',        cls: 'bBlood' },
  presave:      { name: 'Pre-Save',      cls: 'bSlime' },
  download:     { name: 'Download',      cls: 'bAlien' },
  buy:          { name: 'Buy / Merch',   cls: 'bBlood' },
  custom:       { name: 'Link',          cls: 'bAlien' },
};
window.SB_PLATFORMS = SB_PLATFORMS;

/* One shared shape for a content block (used by Page Add-ons and Custom Pages),
   so adding/renaming a block field is a single edit. `heading` gets a friendlier
   default per use-site via spread below. */
const SB_BLOCK = { style: 'centered', kicker: '', heading: '', text: '', image: '', buttonLabel: '', buttonUrl: '', youtube: '' };

/* Blank-item templates so the admin "add" buttons create proper rows. Keyed by
   the array's dotted path (indices stripped). */
const SB_TEMPLATES = {
  'marquee': 'NEW WORD',
  'footer.badges': 'NEW BADGE',
  'music.releases': { title: '', sub: 'single · 2025', type: 'single', img: '', url: '' },
  'about.stats': { n: '', l: '' },
  'landing.stats': { n: '', l: '' },
  'universe.powers': { id: '00', n: 'new force', c: '#8dff2b', tag: '', short: '', lore: '', stats: [['power', 50]] },
  'universe.powers.stats': ['power', 50],
  'vault.items': { title: '', sub: '', img: '', href: '' },
  'videos': { t: '', s: '', id: '', img: '' },
  'shows': { date: '', venue: '', city: '', url: '' },
  // a freeform content block appended to an existing page (adds a target `page`)
  'extras': { page: 'home', ...SB_BLOCK, heading: 'New section' },
  // a brand-new page, pre-seeded with one welcome block
  'pages': { slug: 'new-page', label: 'New Page', nav: true, kicker: 'SB', intro: 'a new corner of the slime world', blocks: [{ ...SB_BLOCK, heading: 'Welcome' }] },
  'pages.blocks': { ...SB_BLOCK, heading: 'New section' },
  // a smart link, pre-seeded with the three core platforms
  'links': { slug: 'new-link', title: 'New Drop', subtitle: 'out now everywhere', artwork: '', portal: true, services: [{ platform: 'spotify', label: '', url: '' }, { platform: 'apple', label: '', url: '' }, { platform: 'youtube', label: '', url: '' }] },
  'links.services': { platform: 'spotify', label: '', url: '' },
};
window.SB_TEMPLATES = SB_TEMPLATES;

/* ---- ADMIN UI METADATA ----
   Drives the enterprise admin: which sections exist, in what order, and how each
   field should be labelled / edited. The admin still walks the live content model,
   but consults this so editors see friendly labels + the right input instead of
   raw JSON. Anything not described here falls back to sensible heuristics. */
/* ---- SITE NAVIGATION ----
   Single source of truth for the top nav, shared by every page (app.js builds
   the navbar from this) so the links stay identical everywhere. Each entry is a
   real page in the multi-page site. */
const SB_NAV = [
  { href: 'index.html',   label: 'home' },
  { href: 'music.html',   label: 'music' },
  { href: 'lab.html',     label: 'slowed' },
  { href: 'world.html',   label: 'sb world' },
  { href: 'vault.html',   label: 'vault' },
  { href: 'shows.html',   label: 'shows' },
  { href: 'connect.html', label: 'tap in' },
  { href: 'links.html',   label: 'links' },
];
window.SB_NAV = SB_NAV;

/* Which page each editable section lives on — lets the admin preview load the
   right page for whatever section is being edited. Keys match SB_SECTIONS. */
const SB_SECTION_PAGE = {
  hero: 'index.html', marquee: 'index.html', drop: 'index.html',
  music: 'music.html',
  about: 'world.html', universe: 'world.html',
  vault: 'vault.html', videos: 'vault.html',
  merch: 'shows.html', shows: 'shows.html',
  contact: 'connect.html', footer: 'index.html',
  landing: 'index.html', rageFx: 'index.html',
  // add-ons preview on the home page; custom pages preview through page.html
  // (the admin retargets these dynamically to the page/slug being edited).
  extras: 'index.html', pages: 'page.html',
  // smart links preview through link.html (admin retargets to the link being edited).
  links: 'links.html',
};
window.SB_SECTION_PAGE = SB_SECTION_PAGE;

const SB_SECTIONS = [
  { key: 'hero',     label: 'Hero',        icon: '☠', desc: 'The first thing visitors see — title, tagline, and backdrop.' },
  { key: 'marquee',  label: 'Marquee',     icon: '➤', desc: 'The scrolling band of words under the hero.' },
  { key: 'drop',     label: 'Featured Drop', icon: '✦', desc: 'Spotlight release, smart links, and the next-drop countdown.' },
  { key: 'landing',  label: 'Landing Info', icon: '⌂', desc: 'Extra info bands on the home page — the intro/bio strip, stat counters, and a tap-in call-to-action.' },
  { key: 'rageFx',   label: 'Rage Mode',   icon: '⚡', desc: 'Pick which effects fire when a visitor hits ☠ rage mode. All effects still respect a visitor’s reduce-motion setting.' },
  { key: 'music',    label: 'Music',       icon: '♫', desc: 'The in-page player, release grid, and Spotify embed.' },
  { key: 'about',    label: 'About',       icon: '✶', desc: 'Bio, portrait, and the stat badges.' },
  { key: 'universe', label: 'SB World',    icon: '◉', desc: 'The five-powers lore map.' },
  { key: 'vault',    label: 'Vault',       icon: '▣', desc: 'Visual grid that opens a lightbox.' },
  { key: 'videos',   label: 'Videos',      icon: '▶', desc: 'YouTube clips (add a video ID to play in-page).' },
  { key: 'merch',    label: 'Merch',       icon: '✪', desc: 'The merch / coming-soon block.' },
  { key: 'shows',    label: 'Shows',       icon: '♪', desc: 'Tour dates. Empty shows a "get alerts" card.' },
  { key: 'contact',  label: 'Contact',     icon: '✉', desc: 'Social links, booking email, and the join-the-list copy.' },
  { key: 'footer',   label: 'Footer',      icon: '⚑', desc: 'Footer badges and copyright line.' },
  { key: 'extras',   label: 'Page Add-ons', icon: '➕', desc: 'Add extra content blocks (heading, text, image, button, or video) to the bottom of any existing page — no code.' },
  { key: 'pages',    label: 'Custom Pages', icon: '❏', desc: 'Build brand-new pages. They appear in the top nav and render from the blocks you add here.' },
  { key: 'links',    label: 'Smart Links', icon: '🔗', desc: 'Link-in-bio smart links for your music. Each lives at slimeby.com/<slug> with a button per platform, and they all collect on your /links portal.' },
];
window.SB_SECTIONS = SB_SECTIONS;

/* field meta keyed by dotted path (array indices stripped).
   type: text | textarea | html | url | email | date | color | number | select
   label / hint / placeholder / options(select) are all optional. */
const SB_SCHEMA = {
  'hero.title':            { label: 'Headline', hint: 'The giant glitch title.' },
  'hero.sub':              { label: 'Tagline', type: 'html', hint: 'Supports <b> (slime green) and <i> (blood red).' },
  'hero.bg':               { label: 'Background image', type: 'image', hint: 'Full-bleed photo behind the hero.' },

  'marquee':               { label: 'Scrolling words', itemLabel: 'word', hint: 'Each entry scrolls across the slime band.' },

  'drop.kicker':           { label: 'Kicker', hint: 'Small label above the heading.' },
  'drop.heading':          { label: 'Heading', type: 'html', hint: 'Wrap a word in <em> to make it slime-green.' },
  'drop.featuredTitle':    { label: 'Release title' },
  'drop.featuredSub':      { label: 'Release subtitle' },
  'drop.cover':            { label: 'Cover art', type: 'image' },
  'drop.spotify':          { label: 'Spotify link', type: 'url' },
  'drop.apple':            { label: 'Apple Music link', type: 'url' },
  'drop.youtube':          { label: 'YouTube link', type: 'url' },
  'drop.presaveUrl':       { label: 'Pre-save link', type: 'url' },
  'drop.dropDate':         { label: 'Next drop date', type: 'date', hint: 'Powers the countdown. After it passes the card reads “OUT NOW”.' },

  'music.playerCover':     { label: 'Player cover art', type: 'image' },
  'music.spotifyArtistId': { label: 'Spotify artist ID', hint: 'The ID in open.spotify.com/artist/<ID>.' },
  'music.bgPlaylist':      { label: 'Background YouTube playlist', hint: 'Playlist ID (the list= value in a youtube.com/playlist link). Visitors skip into it with ⏭ on the music bar. Leave blank to disable.' },
  'music.releases':        { label: 'Releases', itemLabel: 'release', titleKey: 'title' },
  'music.releases.title':  { label: 'Title' },
  'music.releases.sub':    { label: 'Subtitle', placeholder: 'single · 2025' },
  'music.releases.type':   { label: 'Type', type: 'select', options: ['single', 'album'] },
  'music.releases.img':    { label: 'Cover art', type: 'image' },
  'music.releases.url':    { label: 'Link', type: 'url' },

  'about.lead':            { label: 'Lead line', type: 'html' },
  'about.text':            { label: 'Bio', type: 'textarea' },
  'about.portrait':        { label: 'Portrait', type: 'image' },
  'about.badge':           { label: 'Photo badge' },
  'about.stats':           { label: 'Stats', itemLabel: 'stat', titleKey: 'l' },
  'about.stats.n':         { label: 'Number' },
  'about.stats.l':         { label: 'Label' },

  'universe.hint':         { label: 'Hint line' },
  'universe.powers':       { label: 'Powers', itemLabel: 'power', titleKey: 'n' },
  'universe.powers.id':    { label: 'Number', placeholder: '01' },
  'universe.powers.n':     { label: 'Name' },
  'universe.powers.c':     { label: 'Colour', type: 'color' },
  'universe.powers.tag':   { label: 'Tag line' },
  'universe.powers.short': { label: 'Short blurb', type: 'textarea' },
  'universe.powers.lore':  { label: 'Full lore', type: 'textarea' },
  'universe.powers.stats': { label: 'Meters', itemLabel: 'meter' },

  'vault.youtube':         { label: 'YouTube channel', type: 'url' },
  'vault.items':           { label: 'Visuals', itemLabel: 'visual', titleKey: 'title' },
  'vault.items.title':     { label: 'Title' },
  'vault.items.sub':       { label: 'Subtitle' },
  'vault.items.img':       { label: 'Thumbnail', type: 'image' },
  'vault.items.href':      { label: 'Link', type: 'url' },

  'videos':                { label: 'Videos', itemLabel: 'video', titleKey: 't' },
  'videos.t':              { label: 'Title' },
  'videos.s':              { label: 'Subtitle' },
  'videos.id':             { label: 'YouTube video ID or link', hint: 'Paste a YouTube link or just the ID (e.g. dQw4w9WgXcQ). The thumbnail is pulled from YouTube automatically and the clip plays in-page.' },
  'videos.img':            { label: 'Fallback thumbnail (optional)', type: 'image', hint: 'Only used when there is no YouTube ID above. With an ID set, the thumbnail comes from YouTube automatically.' },

  'merch.kicker':          { label: 'Kicker' },
  'merch.heading':         { label: 'Heading', type: 'html' },
  'merch.text':            { label: 'Body', type: 'textarea' },
  'merch.button':          { label: 'Button label' },

  'shows':                 { label: 'Tour dates', itemLabel: 'show', titleKey: 'venue' },
  'shows.date':            { label: 'Date', placeholder: 'JUL 04' },
  'shows.venue':           { label: 'Venue' },
  'shows.city':            { label: 'City' },
  'shows.url':             { label: 'Tickets link', type: 'url' },

  'contact.heading':       { label: 'Heading' },
  'contact.spotify':       { label: 'Spotify', type: 'url' },
  'contact.apple':         { label: 'Apple Music', type: 'url' },
  'contact.youtube':       { label: 'YouTube', type: 'url' },
  'contact.instagram':     { label: 'Instagram', type: 'url' },
  'contact.tiktok':        { label: 'TikTok', type: 'url' },
  'contact.bookingEmail':  { label: 'Booking email', type: 'email' },
  'contact.joinTitle':     { label: 'Join title' },
  'contact.joinSub':       { label: 'Join subtitle', type: 'textarea' },

  'footer.badges':         { label: 'Badges', itemLabel: 'badge' },
  'footer.copy':           { label: 'Copyright line' },

  /* ---- Landing info bands (home page) ---- */
  'landing.intro':           { label: 'Intro / bio band' },
  'landing.intro.show':      { label: 'Show this band' },
  'landing.intro.kicker':    { label: 'Kicker', hint: 'Small label above the heading.' },
  'landing.intro.heading':   { label: 'Heading', type: 'html', hint: 'Wrap a word in <em> to make it slime-green.' },
  'landing.intro.text':      { label: 'Text', type: 'textarea' },
  'landing.intro.image':     { label: 'Image', type: 'image' },
  'landing.intro.buttonLabel': { label: 'Button label', hint: 'Leave blank for no button.' },
  'landing.intro.buttonUrl':   { label: 'Button link', type: 'url' },
  'landing.stats':           { label: 'Stat counters', itemLabel: 'stat', titleKey: 'l' },
  'landing.stats.n':         { label: 'Number' },
  'landing.stats.l':         { label: 'Label' },
  'landing.cta':             { label: 'Tap-in call-to-action' },
  'landing.cta.show':        { label: 'Show this band' },
  'landing.cta.kicker':      { label: 'Kicker' },
  'landing.cta.heading':     { label: 'Heading', type: 'html' },
  'landing.cta.text':        { label: 'Text', type: 'textarea' },
  'landing.cta.buttonLabel': { label: 'Button label' },
  'landing.cta.buttonUrl':   { label: 'Button link', type: 'url' },

  /* ---- Rage mode effects ---- */
  'rageFx.shake':        { label: 'Screen shake', hint: 'The whole page judders.' },
  'rageFx.redOverlay':   { label: 'Venom-red overlay', hint: 'Red scanlines + vignette wash over the screen.' },
  'rageFx.distortAudio': { label: 'Distort the audio', hint: 'Drives + distorts the playing track.' },
  'rageFx.snakeLunge':   { label: 'Snake strikes', hint: 'The background snakes lunge on the beat.' },
  'rageFx.emberBursts':  { label: 'Ember bursts', hint: 'Bursts of red embers across the screen.' },
  'rageFx.strobe':       { label: 'Red strobe', hint: 'Hard red strobe flashes.' },
  'rageFx.lightning':    { label: 'Lightning', hint: 'Jagged lightning bolts crack across the screen.' },
  'rageFx.heartbeat':    { label: 'Heartbeat vignette', hint: 'A pulsing red vignette like a racing pulse.' },
  'rageFx.sparkRain':    { label: 'Spark rain', hint: 'Sparks rain down from the top of the screen.' },
  'rageFx.fire':         { label: 'Fire at the bottom', hint: 'Flames lick up from the bottom edge.' },
  'rageFx.glitch':       { label: 'Glitch / RGB split', hint: 'Occasional datamosh / RGB-split glitch bursts.' },
  'rageFx.bloodDrip':    { label: 'Blood drip', hint: 'Blood drips down from the top of the screen.' },
  'rageFx.static':       { label: 'TV static', hint: 'A noisy TV-static flicker over everything.' },

  /* ---- Page add-ons: extra blocks appended to existing pages ---- */
  'extras':                { label: 'Page add-ons', itemLabel: 'block', titleKey: 'heading' },
  'extras.page':           { label: 'Add to which page', type: 'select', options: ['home', 'music', 'lab', 'world', 'vault', 'shows', 'connect'], hint: 'The block is appended to the bottom of this page.' },
  'extras.style':          { label: 'Layout', type: 'select', options: ['centered', 'left', 'card', 'full'], hint: 'full = the image becomes a full-width banner behind the text.' },
  'extras.kicker':         { label: 'Kicker', hint: 'Small label above the heading. Optional.' },
  'extras.heading':        { label: 'Heading', hint: 'Leave blank to hide.' },
  'extras.text':           { label: 'Text', type: 'textarea', hint: 'Leave blank to hide.' },
  'extras.image':          { label: 'Image', type: 'image', hint: 'Optional.' },
  'extras.buttonLabel':    { label: 'Button label', hint: 'Leave blank for no button.' },
  'extras.buttonUrl':      { label: 'Button link', type: 'url' },
  'extras.youtube':        { label: 'YouTube video', hint: 'Paste a YouTube link or ID to embed a player. Optional.' },

  /* ---- Custom pages ---- */
  'pages':                 { label: 'Custom pages', itemLabel: 'page', titleKey: 'label' },
  'pages.slug':            { label: 'URL slug', type: 'slug', hint: 'Lowercase letters, numbers and dashes. The page lives at page.html?p=<slug>.' },
  'pages.label':           { label: 'Title / nav label' },
  'pages.nav':             { label: 'Show in top nav' },
  'pages.kicker':          { label: 'Header kicker', hint: 'Small label above the big title.' },
  'pages.intro':           { label: 'Header subtitle' },
  'pages.blocks':          { label: 'Blocks', itemLabel: 'block', titleKey: 'heading' },
  'pages.blocks.style':    { label: 'Layout', type: 'select', options: ['centered', 'left', 'card', 'full'] },
  'pages.blocks.kicker':   { label: 'Kicker' },
  'pages.blocks.heading':  { label: 'Heading' },
  'pages.blocks.text':     { label: 'Text', type: 'textarea' },
  'pages.blocks.image':    { label: 'Image', type: 'image' },
  'pages.blocks.buttonLabel': { label: 'Button label' },
  'pages.blocks.buttonUrl':   { label: 'Button link', type: 'url' },
  'pages.blocks.youtube':  { label: 'YouTube video', hint: 'Paste a YouTube link or ID. Optional.' },

  /* ---- Smart links (link-in-bio) ---- */
  'links':                 { label: 'Smart links', itemLabel: 'link', titleKey: 'title' },
  'links.slug':            { label: 'URL slug', type: 'slug', hint: 'Lowercase letters, numbers and dashes. The link lives at slimeby.com/<slug> (also link.html?l=<slug>).' },
  'links.title':           { label: 'Title', hint: 'Song / release name shown big on the landing.' },
  'links.subtitle':        { label: 'Subtitle', hint: 'Small line under the title. Optional.' },
  'links.artwork':         { label: 'Artwork', type: 'image', hint: 'Cover art / photo at the top of the link.' },
  'links.portal':          { label: 'Show on /links portal', hint: 'List this link on your public links hub.' },
  'links.services':        { label: 'Platform buttons', itemLabel: 'button', titleKey: 'platform' },
  'links.services.platform': { label: 'Platform', type: 'select', options: Object.keys(SB_PLATFORMS) },
  'links.services.label':  { label: 'Button label', hint: 'Leave blank to use the platform name.' },
  'links.services.url':    { label: 'Link', type: 'url' },
};
window.SB_SCHEMA = SB_SCHEMA;

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

/* strict read for the ADMIN editor: throws on a failed read instead of silently
   returning defaults, so the editor never loads — and therefore can't publish over —
   the live content when the backend is unreachable. A missing/empty row is still fine
   (a brand-new site legitimately starts from defaults). */
async function sbGetContentStrict() {
  const r = await fetch(SB_CFG.url + '/rest/v1/site_content?id=eq.1&select=data', {
    headers: { apikey: SB_CFG.key, Authorization: 'Bearer ' + SB_CFG.key },
  });
  if (!r.ok) throw new Error('content read failed (HTTP ' + r.status + ')');
  const rows = await r.json();
  const remote = (rows && rows[0] && rows[0].data) || {};
  return sbMerge(SB_DEFAULTS, remote);
}
window.sbGetContentStrict = sbGetContentStrict;

/* call the password-checked edge function: actions = login | save | upload | list_subs | set_password.
   `auth` is the credential: a password string (login) or { token } / { password } object. login
   returns a short-lived token; subsequent calls send the token so the raw password isn't replayed. */
async function sbAdmin(auth, action, payload) {
  const cred = (typeof auth === 'string') ? { password: auth } : (auth || {});
  const r = await fetch(SB_CFG.url + '/functions/v1/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SB_CFG.key, Authorization: 'Bearer ' + SB_CFG.key },
    body: JSON.stringify({ ...cred, action, payload }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; }
  return j;
}
window.sbAdmin = sbAdmin;

/* capture a sign-up in the `subscribers` table (anon insert is allowed by RLS).
   Returns true on success; callers should keep their local fallback regardless. */
async function sbSubscribe(email, phone) {
  // Normalize the address so it matches the unique(email) index that dedupes sign-ups
  // (see migration 20260608120000). Without normalization "A@x.com" and "a@x.com" would
  // both slip past the case-insensitive dedupe we promise.
  email = email ? String(email).trim().toLowerCase() : null;
  try {
    // Plain INSERT — deliberately NOT an upsert. The previous ?on_conflict=email +
    // resolution=ignore-duplicates made PostgREST emit `INSERT ... ON CONFLICT DO NOTHING`,
    // whose speculative-insert path requires the proposed row to be visible to the caller.
    // But the `anon` role has no SELECT policy on `subscribers` (by design — the list can't be
    // read with the public key), so Postgres rejected every sign-up with 42501 "new row
    // violates row-level security policy". The form then silently queued each one under
    // sb_pending and nothing ever reached the table. A plain insert passes the INSERT WITH
    // CHECK policy fine; the unique(email) index still dedupes (see the 409 handling below).
    const r = await fetch(SB_CFG.url + '/rest/v1/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SB_CFG.key,
        Authorization: 'Bearer ' + SB_CFG.key,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ email: email || null, phone: phone || null }),
    });
    // 409 = the unique(email) index rejected a duplicate, i.e. this address is already on the
    // list. From the visitor's perspective that's a success, so treat it as one and don't
    // re-queue it. Any other non-2xx means the row didn't land — surface it instead of
    // silently queueing offline forever.
    if (r.ok || r.status === 409) return true;
    try { console.warn('[sb] subscribe failed', r.status, await r.text()); } catch (_) {}
    return false;
  } catch (_) {
    return false;
  }
}
window.sbSubscribe = sbSubscribe;
