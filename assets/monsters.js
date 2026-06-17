/* ============================================================================
   SLIMÉMON  —  a pocket creature-RPG for the SLIME BY site
   ----------------------------------------------------------------------------
   A faithful, Gen-1-style monster-catching RPG: a tile overworld you walk with
   wild encounters in the tall grass, full turn-based battles (a 6-power type
   chart, STAB, stat stages, status — poison/burn/paralysis/sleep/confusion),
   catching with wobble math, EXP, level-ups, evolution, a party + bag + shop,
   trainers, a gym, a badge and a localStorage save. All art is drawn on the
   canvas (no Nintendo assets) and themed to the SB universe — slime, snakes,
   venom, the 808 sound and green pressure.

   This is a MOUNTABLE module (like assets/quest.js) so it co-operates with the
   site's client-side router: app.js calls SBPoke.mount(root) when monsters.html
   is on screen and the loop auto-stops (SBPoke.unmount) the moment its canvas
   leaves the DOM, so navigating away never leaves a stray rAF / listeners behind.
   Everything renders to one canvas (#pkGame) at a fixed 240x160 logical view,
   scaled crisply to the cabinet.

   The whole thing is driven through a tiny input model (press/hold actions) and
   exposes a read-mostly _debug() surface so the headless sim (tests/poke.sim.mjs)
   can run the REAL engine with no browser and verify the game is winnable.
   ============================================================================ */
(function () {
  "use strict";
  if (window.SBPoke) return;            // defined once; app.js re-mounts the same module

  /* ===================== palette (aligned to the SB site) ===================== */
  const C = {
    slime: '#8dff2b', slimeBright: '#c2ff7a', slimeDeep: '#2a7a00', slimeDark: '#0c2e10',
    toxic: '#d6ff38', gold: '#ffd166', goldLt: '#fff0b0',
    rage: '#ff1f2e', rageSoft: '#ff5a45', rageDeep: '#6e0411',
    purple: '#9b3cff', purpleSoft: '#c47bff', blue: '#3a6bff', cyan: '#38e8ff',
    ink: '#06120a', ink2: '#04060a', bone: '#eafbe4', dim: '#6f9a64',
    box: '#08140b', boxLt: '#0e2412',
    skin: '#c4824f', skin2: '#a4683b',
  };

  /* ===================== render target ===================== */
  const VW = 240, VH = 160, TILE = 16;          // logical view = 15x10 tiles
  let cv = null, ctx = null, root = null, el = {}, scale = 2;
  let ro = null, relayoutQueued = false, inputAC = null;
  const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } })();
  const hasTouch = (() => { try { return 'ontouchstart' in window || navigator.maxTouchPoints > 0; } catch (_) { return false; } })();
  function vibe(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { } }
  const q = id => { try { return document.getElementById(id); } catch (_) { return null; } };

  /* ===================== seedable RNG (deterministic for the sim) ===================== */
  let _seed = (Date.now() >>> 0) || 1;
  function srand(s) { _seed = (s >>> 0) || 1; }
  function rng() { _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0; let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));   // inclusive int in [a,b]
  const chance = p => rng() < p;
  const pick = arr => arr[Math.floor(rng() * arr.length)];

  /* ===================== types + effectiveness ===================== */
  /* The SB "five powers" + neon, as a clean rock-paper-scissors ring:
     each type is 2x vs the next in the ring and 0.5x vs the one before it. */
  const TYPES = ['SLIME', 'SNAKE', 'MOTION', 'SOUND', 'PRESSURE', 'NEON'];
  const TYPECOL = { SLIME: C.slime, SNAKE: C.purple, MOTION: C.blue, SOUND: C.gold, PRESSURE: C.rage, NEON: C.cyan };
  function eff(atkType, defType) {
    const a = TYPES.indexOf(atkType), d = TYPES.indexOf(defType);
    if (a < 0 || d < 0) return 1;
    if (d === (a + 1) % 6) return 2;       // beats the next power in the ring
    if (d === (a + 5) % 6) return 0.5;     // resisted by the previous power
    return 1;
  }
  function effMulti(atkType, defTypes) { let m = 1; for (const t of defTypes) m *= eff(atkType, t); return m; }

  /* ===================== moves ===================== */
  /* cat: 'phys' | 'spec' | 'stat'. effect is interpreted by the battle engine.
     status: psn|brn|par|slp|cnf. stat: {k:'atk'|'def'|'spa'|'spd'|'spe', n:stages, tgt:'self'|'foe'} */
  const MOVES = {
    // SLIME
    slimeslap:   { name: 'SLIME SLAP', type: 'SLIME', cat: 'phys', pow: 45, acc: 100, pp: 30 },
    gooblast:    { name: 'GOO BLAST', type: 'SLIME', cat: 'spec', pow: 55, acc: 100, pp: 20 },
    splatter:    { name: 'SPLATTER', type: 'SLIME', cat: 'spec', pow: 40, acc: 100, pp: 20, fx: { status: 'psn', chance: .3 } },
    dissolve:    { name: 'DISSOLVE', type: 'SLIME', cat: 'stat', pow: 0, acc: 100, pp: 20, fx: { stat: { k: 'def', n: -1, tgt: 'foe' } } },
    megaooze:    { name: 'MEGA OOZE', type: 'SLIME', cat: 'spec', pow: 85, acc: 90, pp: 10 },
    // SNAKE
    chomp:       { name: 'CHOMP', type: 'SNAKE', cat: 'phys', pow: 50, acc: 100, pp: 25 },
    venomfang:   { name: 'VENOM FANG', type: 'SNAKE', cat: 'phys', pow: 50, acc: 100, pp: 15, fx: { status: 'psn', chance: .3 } },
    coil:        { name: 'COIL', type: 'SNAKE', cat: 'stat', pow: 0, acc: 100, pp: 20, fx: { stat: { k: 'atk', n: 1, tgt: 'self' }, stat2: { k: 'def', n: 1, tgt: 'self' } } },
    constrict:   { name: 'CONSTRICT', type: 'SNAKE', cat: 'phys', pow: 35, acc: 100, pp: 20, fx: { stat: { k: 'spe', n: -1, tgt: 'foe' }, chance: .4 } },
    gnash:       { name: 'GNASH', type: 'SNAKE', cat: 'phys', pow: 80, acc: 90, pp: 10 },
    // MOTION
    tackle:      { name: 'TACKLE', type: 'MOTION', cat: 'phys', pow: 40, acc: 100, pp: 35 },
    quickstep:   { name: 'QUICKSTEP', type: 'MOTION', cat: 'stat', pow: 0, acc: 100, pp: 20, fx: { stat: { k: 'spe', n: 2, tgt: 'self' } } },
    bodyslam:    { name: 'BODY SLAM', type: 'MOTION', cat: 'phys', pow: 70, acc: 100, pp: 15, fx: { status: 'par', chance: .25 } },
    whirl:       { name: 'WHIRL', type: 'MOTION', cat: 'phys', pow: 60, acc: 100, pp: 20 },
    blitz:       { name: 'BLITZ', type: 'MOTION', cat: 'phys', pow: 85, acc: 95, pp: 10, fx: { recoil: .25 } },
    // SOUND
    boom808:     { name: '808 BOOM', type: 'SOUND', cat: 'spec', pow: 60, acc: 100, pp: 20 },
    bassdrop:    { name: 'BASS DROP', type: 'SOUND', cat: 'spec', pow: 85, acc: 90, pp: 10 },
    screech:     { name: 'SCREECH', type: 'SOUND', cat: 'stat', pow: 0, acc: 100, pp: 15, fx: { stat: { k: 'def', n: -2, tgt: 'foe' } } },
    echo:        { name: 'ECHO', type: 'SOUND', cat: 'spec', pow: 45, acc: 100, pp: 25 },
    lullaby:     { name: 'LULLABY', type: 'SOUND', cat: 'stat', pow: 0, acc: 70, pp: 10, fx: { status: 'slp', chance: 1 } },
    // PRESSURE
    crush:       { name: 'CRUSH', type: 'PRESSURE', cat: 'phys', pow: 60, acc: 100, pp: 20 },
    greenpress:  { name: 'GREEN PRESSURE', type: 'PRESSURE', cat: 'spec', pow: 70, acc: 100, pp: 15 },
    intimidate:  { name: 'INTIMIDATE', type: 'PRESSURE', cat: 'stat', pow: 0, acc: 100, pp: 20, fx: { stat: { k: 'atk', n: -1, tgt: 'foe' } } },
    heavyset:    { name: 'HEAVYSET', type: 'PRESSURE', cat: 'stat', pow: 0, acc: 100, pp: 20, fx: { stat: { k: 'def', n: 2, tgt: 'self' } } },
    slam:        { name: 'SLAM', type: 'PRESSURE', cat: 'phys', pow: 80, acc: 85, pp: 10 },
    // NEON
    flash:       { name: 'FLASH', type: 'NEON', cat: 'stat', pow: 0, acc: 100, pp: 20, fx: { stat: { k: 'acc', n: -1, tgt: 'foe' } } },
    glitch:      { name: 'GLITCH', type: 'NEON', cat: 'spec', pow: 50, acc: 100, pp: 15, fx: { status: 'cnf', chance: .3 } },
    strobe:      { name: 'STROBE', type: 'NEON', cat: 'spec', pow: 65, acc: 100, pp: 15 },
    shock:       { name: 'SHOCK', type: 'NEON', cat: 'spec', pow: 45, acc: 100, pp: 20, fx: { status: 'par', chance: .2 } },
    overload:    { name: 'OVERLOAD', type: 'NEON', cat: 'spec', pow: 95, acc: 85, pp: 5, fx: { recoil: .25 } },
    // utility (typeless-ish, classed under the user's vibe)
    recharge:    { name: 'RECHARGE', type: 'SOUND', cat: 'stat', pow: 0, acc: 100, pp: 10, fx: { heal: .5 } },
    guard:       { name: 'GUARD', type: 'PRESSURE', cat: 'stat', pow: 0, acc: 100, pp: 30, fx: { stat: { k: 'def', n: 1, tgt: 'self' } } },
  };

  /* ===================== species (the SLIMÉDEX) ===================== */
  /* base stats: [hp, atk, def, spa, spd, spe]. catch: 0-255 (higher = easier).
     arch: drawing archetype. learn: [[level, moveId]...]. evo: {lv, to}. */
  const DEX = {
    // --- starter line: SLIME ---
    driplet:   { id: 'driplet', name: 'DRIPLET', types: ['SLIME'], base: [45, 49, 49, 50, 50, 45], catch: 45, exp: 64, arch: 'blob', col: [C.slime, C.slimeDeep, C.bone], evo: { lv: 16, to: 'oozard' },
      learn: [[1, 'slimeslap'], [1, 'tackle'], [7, 'splatter'], [13, 'dissolve'], [19, 'gooblast'], [28, 'megaooze']],
      flav: 'A bead of living slime. Hums the bassline when it is happy.' },
    oozard:    { id: 'oozard', name: 'OOZARD', types: ['SLIME'], base: [60, 62, 63, 80, 65, 60], catch: 45, exp: 142, arch: 'blob', col: [C.slimeBright, C.slimeDeep, C.bone], evo: { lv: 34, to: 'gloopking' },
      learn: [[1, 'slimeslap'], [1, 'gooblast'], [16, 'dissolve'], [22, 'greenpress'], [30, 'megaooze'], [38, 'recharge']],
      flav: 'It floods low streets after a show. The drip is louder now.' },
    gloopking: { id: 'gloopking', name: 'GLOOPKING', types: ['SLIME', 'PRESSURE'], base: [80, 82, 83, 100, 80, 80], catch: 45, exp: 236, arch: 'blob', col: ['#aaff5a', C.slimeDeep, C.gold],
      learn: [[1, 'megaooze'], [1, 'greenpress'], [34, 'heavyset'], [42, 'crush'], [50, 'bassdrop']],
      flav: 'The crown is solid slime. Green pressure made flesh.' },
    // --- starter line: SNAKE ---
    hisslet:   { id: 'hisslet', name: 'HISSLET', types: ['SNAKE'], base: [44, 56, 40, 50, 50, 55], catch: 45, exp: 64, arch: 'serpent', col: [C.purple, '#5a1f9c', C.toxic], evo: { lv: 16, to: 'sidewind' },
      learn: [[1, 'chomp'], [1, 'tackle'], [7, 'constrict'], [13, 'coil'], [20, 'venomfang'], [28, 'gnash']],
      flav: 'A pocket-sized snake with a big-stage hiss.' },
    sidewind:  { id: 'sidewind', name: 'SIDEWIND', types: ['SNAKE'], base: [60, 75, 52, 60, 58, 78], catch: 45, exp: 142, arch: 'serpent', col: [C.purpleSoft, '#5a1f9c', C.toxic], evo: { lv: 34, to: 'venomba' },
      learn: [[1, 'chomp'], [1, 'venomfang'], [16, 'coil'], [24, 'gnash'], [32, 'intimidate'], [40, 'slam']],
      flav: 'Moves like a hi-hat. Strikes on the offbeat.' },
    venomba:   { id: 'venomba', name: 'VENOMBA', types: ['SNAKE', 'PRESSURE'], base: [80, 100, 70, 75, 72, 95], catch: 45, exp: 236, arch: 'serpent', col: ['#c47bff', '#3a0d6e', C.rage],
      learn: [[1, 'gnash'], [1, 'venomfang'], [34, 'coil'], [44, 'slam'], [52, 'crush']],
      flav: 'The block goes quiet when it uncoils. Pure venom.' },
    // --- starter line: SOUND ---
    buzzlet:   { id: 'buzzlet', name: 'BUZZLET', types: ['SOUND'], base: [40, 45, 45, 60, 50, 50], catch: 45, exp: 64, arch: 'bug', col: [C.gold, '#9c6b00', C.bone], evo: { lv: 16, to: 'bassbud' },
      learn: [[1, 'echo'], [1, 'tackle'], [7, 'boom808'], [13, 'screech'], [21, 'bassdrop'], [30, 'glitch']],
      flav: 'A speaker with wings. Will not stop testing the mic.' },
    bassbud:   { id: 'bassbud', name: 'BASSBUD', types: ['SOUND'], base: [55, 55, 55, 82, 62, 60], catch: 45, exp: 142, arch: 'bug', col: ['#ffe08a', '#9c6b00', C.bone], evo: { lv: 34, to: 'subwoofa' },
      learn: [[1, 'boom808'], [1, 'echo'], [16, 'screech'], [24, 'bassdrop'], [33, 'lullaby'], [40, 'overload']],
      flav: 'Blooms into a subwoofer. The low end has roots now.' },
    subwoofa:  { id: 'subwoofa', name: 'SUBWOOFA', types: ['SOUND', 'NEON'], base: [75, 70, 70, 105, 80, 78], catch: 45, exp: 236, arch: 'bug', col: [C.gold, '#3a6bff', C.cyan],
      learn: [[1, 'bassdrop'], [1, 'strobe'], [34, 'overload'], [44, 'boom808'], [52, 'glitch']],
      flav: 'Felt before it is heard. Rattles the whole venue.' },
    // --- wild route 'mon ---
    scrat:     { id: 'scrat', name: 'SCRAT', types: ['MOTION'], base: [35, 45, 35, 30, 35, 60], catch: 200, exp: 51, arch: 'beast', col: ['#9c7a52', '#5c4424', C.bone], evo: { lv: 18, to: 'scrapper' },
      learn: [[1, 'tackle'], [1, 'whirl'], [10, 'quickstep'], [16, 'bodyslam'], [24, 'blitz']],
      flav: 'An alley critter that never sits still.' },
    scrapper:  { id: 'scrapper', name: 'SCRAPPER', types: ['MOTION', 'PRESSURE'], base: [60, 75, 55, 45, 55, 88], catch: 90, exp: 145, arch: 'beast', col: ['#b58a5c', '#4c3418', C.rage],
      learn: [[1, 'whirl'], [1, 'bodyslam'], [18, 'blitz'], [26, 'crush'], [34, 'intimidate']],
      flav: 'Runs the block. Settles every beef with motion.' },
    globlet:   { id: 'globlet', name: 'GLOBLET', types: ['SLIME'], base: [50, 40, 55, 40, 50, 25], catch: 190, exp: 60, arch: 'blob', col: ['#7fe04a', '#1f6e10', C.toxic], evo: { lv: 22, to: 'globbo' },
      learn: [[1, 'slimeslap'], [1, 'splatter'], [12, 'dissolve'], [20, 'gooblast'], [28, 'recharge']],
      flav: 'Harmless drip. Sticks to absolutely everything.' },
    globbo:    { id: 'globbo', name: 'GLOBBO', types: ['SLIME'], base: [80, 60, 80, 60, 70, 35], catch: 75, exp: 160, arch: 'blob', col: ['#6fd038', '#1f6e10', C.gold],
      learn: [[1, 'gooblast'], [1, 'dissolve'], [22, 'greenpress'], [30, 'heavyset'], [40, 'megaooze']],
      flav: 'A whole puddle with opinions. Slow but immovable.' },
    coiling:   { id: 'coiling', name: 'COILING', types: ['SNAKE'], base: [42, 52, 48, 40, 45, 58], catch: 160, exp: 62, arch: 'serpent', col: ['#5fae3a', '#26521c', C.toxic], evo: { lv: 22, to: 'kobrang' },
      learn: [[1, 'chomp'], [1, 'constrict'], [12, 'coil'], [20, 'venomfang'], [27, 'gnash']],
      flav: 'Basks on warm speakers. Quick to coil up.' },
    kobrang:   { id: 'kobrang', name: 'KOBRANG', types: ['SNAKE'], base: [68, 80, 64, 60, 60, 84], catch: 70, exp: 158, arch: 'serpent', col: ['#7ad44a', '#1f6e10', C.rage],
      learn: [[1, 'venomfang'], [1, 'coil'], [22, 'gnash'], [30, 'intimidate'], [38, 'slam']],
      flav: 'Hood flared, fangs out. Owns the tall grass.' },
    neonmoth:  { id: 'neonmoth', name: 'NEONMOTH', types: ['NEON'], base: [50, 45, 50, 70, 60, 75], catch: 120, exp: 130, arch: 'wisp', col: [C.cyan, '#1f6e8c', C.purpleSoft],
      learn: [[1, 'flash'], [1, 'shock'], [1, 'strobe'], [24, 'glitch'], [34, 'overload']],
      flav: 'Drawn to stage lights. Leaves a trail of static.' },
    thumpa:    { id: 'thumpa', name: 'THUMPA', types: ['MOTION'], base: [70, 70, 70, 40, 55, 45], catch: 90, exp: 135, arch: 'golem', col: ['#8a98b5', '#3a4660', C.cyan],
      learn: [[1, 'tackle'], [1, 'crush'], [1, 'whirl'], [26, 'bodyslam'], [36, 'slam']],
      flav: 'A walking kick drum. Every step is a downbeat.' },
    presso:    { id: 'presso', name: 'PRESSO', types: ['PRESSURE'], base: [65, 80, 75, 70, 70, 55], catch: 60, exp: 170, arch: 'golem', col: [C.rage, '#6e0411', C.gold],
      learn: [[1, 'crush'], [1, 'intimidate'], [1, 'greenpress'], [28, 'heavyset'], [38, 'slam']],
      flav: 'Carries the weight of the whole city on it.' },
    snagon:    { id: 'snagon', name: 'SNAGON', types: ['SNAKE', 'PRESSURE'], base: [90, 105, 85, 80, 80, 90], catch: 30, exp: 220, arch: 'serpent', col: [C.rage, '#3a0d6e', C.gold],
      learn: [[1, 'gnash'], [1, 'crush'], [1, 'coil'], [1, 'slam'], [40, 'greenpress']],
      flav: 'The Red Serpent. They say its hiss starts mosh pits.' },
  };
  const STARTERS = ['driplet', 'hisslet', 'buzzlet'];

  /* ===================== items ===================== */
  const ITEMS = {
    slimeball:  { name: 'SLIME BALL', kind: 'ball', bonus: 1, price: 200, desc: 'A basic ball. Toss it at a weakened slimémon.' },
    toxinball:  { name: 'TOXIN BALL', kind: 'ball', bonus: 1.5, price: 600, desc: 'A better ball. A higher catch rate.' },
    venomball:  { name: 'VENOM BALL', kind: 'ball', bonus: 2, price: 1200, desc: 'A high-grade ball. Great catch rate.' },
    eightball:  { name: '808 BALL', kind: 'ball', bonus: 255, price: 0, desc: 'The legendary ball. Never misses a catch.' },
    potion:     { name: 'POTION', kind: 'heal', heal: 20, price: 200, desc: 'Restores 20 HP to one slimémon.' },
    superpot:   { name: 'SUPER POTION', kind: 'heal', heal: 50, price: 700, desc: 'Restores 50 HP to one slimémon.' },
    antidote:   { name: 'ANTIDOTE', kind: 'cure', cure: 'psn', price: 100, desc: 'Cures poison.' },
    awakening:  { name: 'AWAKENING', kind: 'cure', cure: 'slp', price: 250, desc: 'Wakes a sleeping slimémon.' },
    freshener:  { name: 'FRESHENER', kind: 'cure', cure: 'all', price: 300, desc: 'Clears any status condition.' },
    revive:     { name: 'REVIVE', kind: 'revive', price: 1500, desc: 'Revives a fainted slimémon to half HP.' },
  };
  const SHOP = ['slimeball', 'toxinball', 'potion', 'superpot', 'antidote', 'awakening', 'revive'];

  /* ===================== maps ===================== */
  /* tile chars — solid set below. 'G' = tall grass (encounters). warps + npcs are
     attached per-map by coordinate. Interiors use _ floor / = counter / b shelf / M exit-mat. */
  const SOLID = new Set([' ', '#', 'T', 'W', 'H', 'R', 'S', '=', 'b', 'P']);
  const ENCOUNTER = new Set(['G']);
  function M(str) { return str.replace(/\n$/, '').split('\n'); }

  const MAPS = {
    town: {
      name: 'SLIMEHOME', music: 'town',
      grid: M(
`TTTTTTTTTTTTTTTTTTTT
T,,,,,,,,,,,,,,,,,,T
T,,RRRR,,,,,RRRR,,,T
T,,HHHH,,ff,,HHHH,,T
T,,HHDH,,ff,,HDHH,,T
T,,,,,,,,,,,,,,,,,,T
T,,,,,,,,S,,,,,,,,,T
T,,RRRRRR,,,,,,,,,,T
T,,RHHHHR,,,ff,,,,,T
T,,RHHDHR,,,ff,,,,,T
T,,,,,,,,,,,,,,,,,,T
T,,,,,,,,,,,,,,,,,,T
TTTTTTTT,,,,TTTTTTTT`),
      warps: [
        { x: 5, y: 4, to: 'home', tx: 3, ty: 5 },     // player's house (left)
        { x: 13, y: 4, to: 'rival_h', tx: 3, ty: 5 },  // neighbor
        { x: 5, y: 9, to: 'lab', tx: 4, ty: 7 },       // Prof Drip's lab
        { x: 8, y: 12, to: 'route1', tx: 10, ty: 19 },  // south? no — north exit to route
        { x: 9, y: 12, to: 'route1', tx: 11, ty: 19 },
      ],
      npcs: [
        { x: 9, y: 5, dir: 'd', sprite: 'mom', name: 'MOM', heal: true,
          lines: ['Off to chase the slime, baby?', 'Rest up — I patched your team.'] },
        { x: 14, y: 6, dir: 'l', sprite: 'rival', name: 'SMOKE',
          lines: ['Yo. Prof Drip\'s handing out slimémon.', 'Bet I pick a better one than you. Move!'] },
      ],
      signs: { '8,6': 'SLIMEHOME TOWN — where the drip starts. North to Route 1.' },
    },

    home: {
      name: 'YOUR ROOM', interior: true,
      grid: M(
`bbbbbbb
b__=__b
b_____b
b__P__b
b_____b
b_M___b
bbbbbbb`),
      warps: [{ x: 2, y: 5, to: 'town', tx: 5, ty: 5 }],
      npcs: [],
      signs: { '4,1': 'A dusty SB poster. "GREEN PRESSURE" in dripping letters.' },
    },

    rival_h: {
      name: 'SMOKE\'S PLACE', interior: true,
      grid: M(
`bbbbbbb
b__=__b
b_b_b_b
b_____b
b_____b
b_M___b
bbbbbbb`),
      warps: [{ x: 2, y: 5, to: 'town', tx: 13, ty: 5 }],
      npcs: [{ x: 4, y: 3, dir: 'd', sprite: 'mom', name: 'SMOKE\'S MOM', lines: ['Smoke already ran to the lab.', 'You two and those slimémon...'] }],
      signs: {},
    },

    lab: {
      name: 'DRIP LAB', interior: true,
      grid: M(
`bbbbbbbbb
b__bbb__b
b_______b
b__===__b
b_______b
b_______b
b___P___b
b___M___b
bbbbbbbbb`),
      warps: [{ x: 4, y: 7, to: 'town', tx: 5, ty: 9 }],
      npcs: [
        { x: 4, y: 2, dir: 'd', sprite: 'prof', name: 'PROF. DRIP', starter: true,
          lines: ['Welcome to the lab! I study slimémon.', 'Three of them are on that table.', 'Step up and pick the one that moves you.'] },
      ],
      // the three starter "balls" on the desk — interacting picks a starter
      starters: [{ x: 3, y: 3, id: 'driplet' }, { x: 4, y: 3, id: 'hisslet' }, { x: 5, y: 3, id: 'buzzlet' }],
      signs: {},
    },

    route1: {
      name: 'ROUTE 1', music: 'route',
      grid: M(
`TTTTTTTTTTTTTTTTTTTTTT
T,,,,,,,,,,,,,,,,,,,,T
T,,GGGG,,,,,,,,GGGG,,T
T,,GGGG,,,,,,,,GGGG,,T
T,,GGGG,,TT,,,,GGGG,,T
T,,,,,,,,TT,,,,,,,,,,T
T,,,,,,,,,,,,,,,,,,,,T
T,,GGGGGG,,,,GGGGGG,,T
T,,GGGGGG,,,,GGGGGG,,T
T,,GGGGGG,,,,GGGGGG,,T
T,,,,,,,,,,,,,,,,,,,,T
T,,,,,,,S,,,,,,,,,,,,T
T,,TT,,,,,,,,,,TT,,,,T
T,,TT,,GGGG,,,,TT,,,,T
T,,,,,,GGGG,,,,,,,,,,T
T,,,,,,GGGG,,,,,,,,,,T
T,,,,,,,,,,,,,,,,,,,,T
T,,,,,,,,,,,,,,,,,,,,T
TTTTTTTTTT,,TTTTTTTTTT
,,,,,,,,,,,,,,,,,,,,,,`),
      // top edge (row 0) leads back to town; bottom (row 19) leads to Fangton
      warps: [
        { x: 10, y: 0, to: 'town', tx: 8, ty: 11 }, { x: 11, y: 0, to: 'town', tx: 9, ty: 11 },
        { x: 10, y: 19, to: 'fangton', tx: 9, ty: 1 }, { x: 11, y: 19, to: 'fangton', tx: 10, ty: 1 },
      ],
      encounters: [
        { id: 'scrat', min: 2, max: 5, w: 30 }, { id: 'globlet', min: 2, max: 5, w: 25 },
        { id: 'coiling', min: 3, max: 6, w: 20 }, { id: 'buzzlet', min: 3, max: 5, w: 10 },
        { id: 'neonmoth', min: 4, max: 6, w: 8 }, { id: 'thumpa', min: 4, max: 7, w: 7 },
      ],
      encRate: 0.12,
      npcs: [
        { x: 14, y: 5, dir: 'l', sprite: 'scout', name: 'SLIME SCOUT', trainer: true, beaten: false,
          team: [['globlet', 6], ['coiling', 6]], reward: 240,
          lines: ['You step in my grass, you battle me!'], lose: ['No way! My drip ran dry...'] },
        { x: 8, y: 14, dir: 'r', sprite: 'biker', name: 'BIKER REV', trainer: true, beaten: false,
          team: [['scrat', 7], ['scrat', 7], ['thumpa', 8]], reward: 320,
          lines: ['Too slow! Motion beats everything.'], lose: ['Tch. You\'ve got speed too, huh.'] },
      ],
      signs: { '8,11': 'ROUTE 1 — tall grass crawls with wild slimémon. South to FANGTON.' },
    },

    fangton: {
      name: 'FANGTON', music: 'town',
      grid: M(
`TTTTTTTTTTTTTTTTTTTT
T,,,,,,,,,,,,,,,,,,T
T,,RRRRRR,,,,,,,,,,T
T,,RHHHHR,,RRRRRR,,T
T,,RHHDHR,,RHHHHR,,T
T,,,,,,,,,,RHHDHR,,T
T,,,,,,,,S,,,,,,,,,T
T,,,,,,,,,,,,,,,,,,T
T,,,,RRRRRRRR,,,,,,T
T,,,,RHHHHHHR,,,,,,T
T,,,,RHHHDHHR,,,,,,T
T,,,,,,,,,,,,,,,,,,T
T,,,,,,,,,,,,,,,,,,T
TTTTTTTT,,TTTTTTTTTT`),
      warps: [
        { x: 5, y: 4, to: 'clinic', tx: 4, ty: 7 },     // SLIME CLINIC (left house)
        { x: 13, y: 4, to: 'shop', tx: 3, ty: 6 },       // shop (right house)
        { x: 9, y: 10, to: 'gym', tx: 5, ty: 11 },        // FANG GYM (big building)
        { x: 8, y: 13, to: 'route1', tx: 10, ty: 18 }, { x: 9, y: 13, to: 'route1', tx: 11, ty: 18 },
      ],
      npcs: [
        { x: 12, y: 8, dir: 'd', sprite: 'rapper', name: 'HYPEMAN', lines: ['The Fang Gym? Leader VIPER runs SNAKE types.', 'Pack some MOTION moves — they bite back.'] },
      ],
      signs: { '8,6': 'FANGTON — heal at the CLINIC, gear up at the SHOP, prove it at the FANG GYM.' },
    },

    clinic: {
      name: 'SLIME CLINIC', interior: true,
      grid: M(
`bbbbbbbbb
b__===__b
b___P___b
b_______b
b_______b
b___M___b
bbbbbbbbb`),
      warps: [{ x: 4, y: 5, to: 'fangton', tx: 5, ty: 5 }],
      npcs: [{ x: 4, y: 1, dir: 'd', sprite: 'nurse', name: 'NURSE', heal: true,
        lines: ['Welcome to the Slime Clinic!', 'Want me to recharge your team?'] }],
      signs: {},
    },

    shop: {
      name: 'SB SHOP', interior: true,
      grid: M(
`bbbbbbb
b_===_b
b__P__b
b_____b
b_____b
b__M__b
bbbbbbb`),
      warps: [{ x: 3, y: 5, to: 'fangton', tx: 13, ty: 5 }],
      npcs: [{ x: 3, y: 1, dir: 'd', sprite: 'clerk', name: 'CLERK', shop: true,
        lines: ['Welcome to the SB Shop. Buying?'] }],
      signs: {},
    },

    gym: {
      name: 'FANG GYM', interior: true, music: 'gym',
      grid: M(
`bbbbbbbbbbb
b____P____b
b_________b
b__b___b__b
b_________b
b__P___P__b
b_________b
b_________b
b____M____b
bbbbbbbbbbb`),
      warps: [{ x: 5, y: 8, to: 'fangton', tx: 9, ty: 9 }],
      npcs: [
        { x: 3, y: 5, dir: 'd', sprite: 'scout', name: 'GYM GRUNT', trainer: true, beaten: false,
          team: [['coiling', 12], ['kobrang', 13]], reward: 520,
          lines: ['No one reaches VIPER without fangs!'], lose: ['You\'ve got bite. Go on.'] },
        { x: 7, y: 5, dir: 'd', sprite: 'biker', name: 'GYM GRUNT', trainer: true, beaten: false,
          team: [['scrapper', 13], ['coiling', 12]], reward: 520,
          lines: ['Snakes AND speed. Beat that.'], lose: ['Fast hands. Respect.'] },
        { x: 5, y: 1, dir: 'd', sprite: 'viper', name: 'LEADER VIPER', trainer: true, leader: true, beaten: false,
          team: [['sidewind', 16], ['kobrang', 16], ['snagon', 19]], reward: 3000,
          lines: ['So you climbed to the throne room.', 'I am VIPER. My snakes end the show.', 'Show me your venom!'],
          lose: ['...The Red Serpent falls.', 'Take the FANG BADGE. You earned the block.'] },
      ],
      signs: {},
    },
  };

  /* ===================== save / state ===================== */
  let mem = {};   // memory fallback when localStorage is unavailable (e.g. the sim)
  const SAVE_KEY = 'sb_poke_save';
  function store(k, v) { try { localStorage.setItem(k, v); } catch (_) { mem[k] = v; } }
  function load(k) { try { const v = localStorage.getItem(k); return v == null ? (k in mem ? mem[k] : null) : v; } catch (_) { return (k in mem ? mem[k] : null); } }
  function del(k) { try { localStorage.removeItem(k); } catch (_) { } delete mem[k]; }

  /* live game state (populated by newGame / continueGame) */
  let G = null;

  function newGame(starterId) {
    G = {
      map: 'home', px: 3, py: 3, dir: 'd',
      party: [], box: [],
      bag: { slimeball: 5, potion: 3 },
      money: 1500, badges: 0,
      dexSeen: {}, dexCaught: {},
      flags: { gotStarter: false, rivalBeaten: false },
      starter: null,
    };
    if (starterId) giveStarter(starterId);
    return G;
  }

  /* ===================== mon instances ===================== */
  function statAt(base, lv, isHp) {
    if (isHp) return Math.floor((base * 2 * lv) / 100) + lv + 10;
    return Math.floor((base * 2 * lv) / 100) + 5;
  }
  function movesAtLevel(spId, lv) {
    const sp = DEX[spId]; const learned = [];
    for (const [l, mv] of sp.learn) if (l <= lv) learned.push(mv);
    const last4 = learned.slice(-4);
    return last4.map(id => ({ id, pp: MOVES[id].pp, max: MOVES[id].pp }));
  }
  function makeMon(spId, lv, opts) {
    opts = opts || {};
    const sp = DEX[spId];
    const maxHp = statAt(sp.base[0], lv, true);
    const m = {
      sp: spId, name: sp.name, lv, exp: lv * lv * lv,
      maxHp, hp: maxHp, status: null, slpT: 0, cnfT: 0,
      moves: opts.moves || movesAtLevel(spId, lv),
      stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 },
    };
    return m;
  }
  const stat = (m, k) => {
    const sp = DEX[m.sp];
    const idx = { atk: 1, def: 2, spa: 3, spd: 4, spe: 5 }[k];
    return statAt(sp.base[idx], m.lv, false);
  };
  function stageMul(s) { return s >= 0 ? (2 + s) / 2 : 2 / (2 - s); }
  function effStat(m, k) {
    let v = stat(m, k) * stageMul(m.stages[k] || 0);
    if (k === 'atk' && m.status === 'brn') v *= 0.5;
    if (k === 'spe' && m.status === 'par') v *= 0.25;
    return Math.max(1, Math.floor(v));
  }
  function healMon(m) { m.hp = m.maxHp; m.status = null; m.slpT = 0; m.cnfT = 0; for (const mv of m.moves) mv.pp = mv.max; resetStages(m); }
  function resetStages(m) { m.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 }; }
  function healParty() { for (const m of G.party) healMon(m); }
  function expToNext(m) { return (m.lv + 1) ** 3 - m.lv ** 3; }
  function seeDex(id) { if (G) G.dexSeen[id] = 1; }
  function catchDex(id) { if (G) { G.dexSeen[id] = 1; G.dexCaught[id] = 1; } }

  function giveStarter(id) {
    const m = makeMon(id, 5);
    G.party = [m]; G.starter = id; G.flags.gotStarter = true;
    catchDex(id);
  }
  function addMon(m) {
    if (G.party.length < 6) { G.party.push(m); return 'party'; }
    G.box.push(m); return 'box';
  }

  /* serialization keeps saves tiny — only the live, mutable bits */
  function serializeMon(m) { return { s: m.sp, l: m.lv, e: m.exp, h: m.hp, st: m.status, mv: m.moves.map(x => [x.id, x.pp]) }; }
  function deserializeMon(o) {
    const m = makeMon(o.s, o.l, { moves: o.mv.map(([id, pp]) => ({ id, pp, max: MOVES[id].pp })) });
    m.exp = o.e != null ? o.e : m.exp; m.hp = o.h != null ? o.h : m.maxHp; m.status = o.st || null;
    return m;
  }
  function saveGame() {
    if (!G) return false;
    const data = {
      v: 1, map: G.map, px: G.px, py: G.py, dir: G.dir,
      party: G.party.map(serializeMon), box: G.box.map(serializeMon),
      bag: G.bag, money: G.money, badges: G.badges,
      seen: G.dexSeen, caught: G.dexCaught, flags: G.flags, starter: G.starter,
      beaten: collectBeaten(),
    };
    store(SAVE_KEY, JSON.stringify(data));
    return true;
  }
  function hasSave() { return !!load(SAVE_KEY); }
  function continueGame() {
    let data; try { data = JSON.parse(load(SAVE_KEY)); } catch (_) { return false; }
    if (!data) return false;
    G = {
      map: data.map, px: data.px, py: data.py, dir: data.dir || 'd',
      party: (data.party || []).map(deserializeMon), box: (data.box || []).map(deserializeMon),
      bag: data.bag || { slimeball: 5 }, money: data.money || 0, badges: data.badges || 0,
      dexSeen: data.seen || {}, dexCaught: data.caught || {}, flags: data.flags || {}, starter: data.starter || null,
    };
    applyBeaten(data.beaten || {});
    return true;
  }
  /* trainer "beaten" flags live on the map NPC objects; persist them by a stable key */
  function collectBeaten() {
    const out = {};
    for (const mk in MAPS) (MAPS[mk].npcs || []).forEach((n, i) => { if (n.trainer && n.beaten) out[mk + ':' + i] = 1; });
    return out;
  }
  function applyBeaten(b) {
    for (const mk in MAPS) (MAPS[mk].npcs || []).forEach((n, i) => { if (n.trainer) n.beaten = !!b[mk + ':' + i]; });
  }
  function resetBeaten() { for (const mk in MAPS) (MAPS[mk].npcs || []).forEach(n => { if (n.trainer) n.beaten = false; }); }

  /* ============================================================================
     RUNTIME — input, overworld, battle, menus, render + the mount lifecycle.
     Everything lives in this one closure so it reaches the data + state above.
     ============================================================================ */

  let mode = 'title', sayReturn = 'field', askReturn = 'field';
  let B = null;                          // active battle state (null off the field)
  let msgQ = [], msgCb = null;           // overworld dialogue queue
  let choiceState = null, menuState = null, teamState = null, bagState = null, shopState = null, dexState = null;
  let titleCursor = 0;
  let held = {}, pressed = [], downKeys = {};
  let walkT = 0, stepFrom = null, walkSteps = 0;
  let cam = { x: 0, y: 0 };
  let fade = 0, fadeTo = 0, fadeCb = null;
  let blink = 0, anim = 0, running = false, rafId = 0, lastF = 0, offX = 0, offY = 0;
  const STEP_MS = 130;
  const DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const dirOf = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  const faceLetter = { up: 'u', down: 'd', left: 'l', right: 'r' };
  const opp = { up: 'd', down: 'u', left: 'r', right: 'l' };
  const FONT = '"Courier New",monospace';

  /* ===================== input ===================== */
  function pushEdge(a) { pressed.push(a); }
  function setHeld(a, on) { if (a === 'up' || a === 'down' || a === 'left' || a === 'right') { if (on) held[a] = true; else delete held[a]; } }
  function onKey(e, down) {
    const c = e.code; let a = null, dir = false;
    switch (c) {
      case 'ArrowUp': case 'KeyW': a = 'up'; dir = true; break;
      case 'ArrowDown': case 'KeyS': a = 'down'; dir = true; break;
      case 'ArrowLeft': case 'KeyA': a = 'left'; dir = true; break;
      case 'ArrowRight': case 'KeyD': a = 'right'; dir = true; break;
      case 'KeyZ': case 'Space': case 'KeyJ': a = 'a'; break;
      case 'KeyX': case 'Backspace': case 'KeyK': a = 'b'; break;
      case 'Enter': case 'NumpadEnter': a = 'start'; break;
      case 'ShiftLeft': case 'ShiftRight': a = 'select'; break;
      default: return false;
    }
    if (down) { if (dir) setHeld(a, true); pushEdge(a); }
    else if (dir) setHeld(a, false);
    try { e.preventDefault(); e.stopPropagation(); } catch (_) { }
    return true;
  }
  function bindInputs() {
    inputAC = new AbortController(); const sig = inputAC.signal;
    addEventListener('keydown', e => {
      if (downKeys[e.code]) { onKey({ code: e.code, preventDefault() { }, stopPropagation() { } }, true) && (e.preventDefault(), e.stopPropagation()); return; }
      downKeys[e.code] = true; onKey(e, true);
    }, { capture: true, signal: sig });
    addEventListener('keyup', e => { downKeys[e.code] = false; onKey(e, false); }, { capture: true, signal: sig });
    addEventListener('blur', () => { held = {}; downKeys = {}; }, { signal: sig });
  }
  function bindTouch(elm, dn, up) {
    if (!elm) return; const sig = inputAC.signal; let active = false;
    const press = e => { if (active) return; active = true; elm.classList.add('pressed'); try { e.preventDefault(); } catch (_) { } vibe(7); dn && dn(); };
    const release = e => { if (!active) return; active = false; elm.classList.remove('pressed'); try { e && e.preventDefault(); } catch (_) { } up && up(); };
    elm.addEventListener('pointerdown', press, { signal: sig });
    elm.addEventListener('pointerup', release, { signal: sig });
    elm.addEventListener('pointercancel', release, { signal: sig });
    elm.addEventListener('pointerleave', release, { signal: sig });
  }

  /* ===================== overworld ===================== */
  function tileAt(map, x, y) { const g = MAPS[map].grid; if (y < 0 || y >= g.length) return ' '; const row = g[y]; if (x < 0 || x >= row.length) return ' '; return row[x]; }
  function npcAt(map, x, y) { return (MAPS[map].npcs || []).find(n => n.x === x && n.y === y && !n._gone); }
  function starterAt(map, x, y) { return (MAPS[map].starters || []).find(s => s.x === x && s.y === y); }
  function solidAt(map, x, y) {
    if (SOLID.has(tileAt(map, x, y))) return true;
    if (npcAt(map, x, y)) return true;
    if (starterAt(map, x, y)) return true;
    return false;
  }
  function mapPx(map) { const g = MAPS[map].grid; return { w: Math.max(...g.map(r => r.length)) * TILE, h: g.length * TILE }; }

  function fieldUpdate(dt) {
    if (fade) return;                          // mid-transition: ignore input
    if (walkT > 0) { walkT -= dt; if (walkT <= 0) { walkT = 0; onArrive(); } return; }
    for (const a of pressed) {
      if (a === 'start') { openMenu(); return; }
      if (a === 'a') { interact(); return; }
    }
    let d = null;
    for (const k of ['up', 'down', 'left', 'right']) if (held[k]) { d = k; break; }
    if (d) {
      G.dir = d; const [dx, dy] = DV[d]; const nx = G.px + dx, ny = G.py + dy;
      if (!solidAt(G.map, nx, ny)) { stepFrom = { x: G.px, y: G.py }; G.px = nx; G.py = ny; walkT = STEP_MS; walkSteps++; }
    }
  }
  function onArrive() {
    const w = (MAPS[G.map].warps || []).find(w => w.x === G.px && w.y === G.py);
    if (w) { doWarp(w); return; }
    if (tileAt(G.map, G.px, G.py) === 'G') { maybeEncounter(); if (mode === 'battle') return; }
    checkTrainerSight();
  }
  function doWarp(w) {
    fadeOut(() => { G.map = w.to; G.px = w.tx; G.py = w.ty; walkT = 0; stepFrom = null; snapCam(); });
  }
  function maybeEncounter() {
    const m = MAPS[G.map]; if (!m.encounters || !m.encounters.length) return;
    if (!chance(m.encRate || 0.1)) return;
    const total = m.encounters.reduce((s, e) => s + e.w, 0); let r = rng() * total, e = m.encounters[0];
    for (const c of m.encounters) { if (r < c.w) { e = c; break; } r -= c.w; }
    beginWild(makeMon(e.id, ri(e.min, e.max)));
  }
  function checkTrainerSight() {
    for (const n of (MAPS[G.map].npcs || [])) {
      if (!n.trainer || n.beaten) continue;
      const v = dirOf[n.dir] || dirOf.d;
      for (let s = 1; s <= 4; s++) {
        const tx = n.x + v[0] * s, ty = n.y + v[1] * s;
        if (SOLID.has(tileAt(G.map, tx, ty))) break;
        const o = npcAt(G.map, tx, ty); if (o && o !== n) break;
        if (tx === G.px && ty === G.py) { say(['! ' + n.name + ' spotted you!'], () => startTrainerBattle(n)); return; }
      }
    }
  }
  function interact() {
    const v = dirOf[faceLetter[G.dir]]; const fx = G.px + v[0], fy = G.py + v[1];
    const st = starterAt(G.map, fx, fy); if (st) { pickStarter(st.id); return; }
    const n = npcAt(G.map, fx, fy); if (n) { talkTo(n); return; }
    const sg = (MAPS[G.map].signs || {})[fx + ',' + fy]; if (sg) { say([sg]); return; }
  }
  function talkTo(n) {
    n.dir = opp[G.dir] || n.dir;
    if (n.trainer && !n.beaten) { say(n.lines, () => startTrainerBattle(n)); return; }
    if (n.heal) { say(n.lines, askHeal); return; }
    if (n.shop) { say(n.lines, openShop); return; }
    if (n.starter) { say(G.flags.gotStarter ? ['That team looks strong!', 'Go earn the FANG BADGE.'] : n.lines); return; }
    say(n.lines);
  }
  function pickStarter(id) {
    if (G.flags.gotStarter) { say(['You already chose ' + DEX[G.starter].name + '.']); return; }
    ask('The ' + DEX[id].name + '! Take it?', [
      { label: 'YES', cb: () => { giveStarter(id); G.respawn = { map: 'town', x: 9, y: 6 }; say(['PROF. DRIP: ' + DEX[id].name + ' is yours!', 'Now — into the tall grass!']); } },
      { label: 'NO', cb: () => { say(['Take your time. Choose well.']); } },
    ]);
  }
  function askHeal() {
    ask('Recharge your team?', [
      { label: 'YES', cb: () => { healParty(); G.respawn = { map: G.map === 'clinic' ? 'fangton' : 'town', x: G.map === 'clinic' ? 9 : 9, y: 6 }; say(['Your team is fully charged!']); } },
      { label: 'NO', cb: () => { say(['Stay slimy.']); } },
    ]);
  }

  /* ===================== overworld menus ===================== */
  function say(lines, after) { msgQ = (Array.isArray(lines) ? lines : [lines]).slice(); msgCb = after || null; sayReturn = (mode === 'dialog' ? sayReturn : mode); mode = 'dialog'; }
  function sayAdvance() { if (msgQ.length > 1) msgQ.shift(); else { msgQ = []; const cb = msgCb; msgCb = null; mode = 'field'; if (cb) cb(); } }
  function ask(prompt, opts) { choiceState = { prompt, opts, cursor: 0 }; askReturn = (mode === 'choice' ? askReturn : mode); mode = 'choice'; }
  function choiceUpdate() {
    for (const a of pressed) {
      if (a === 'up' || a === 'left') choiceState.cursor = (choiceState.cursor + choiceState.opts.length - 1) % choiceState.opts.length;
      else if (a === 'down' || a === 'right') choiceState.cursor = (choiceState.cursor + 1) % choiceState.opts.length;
      else if (a === 'a' || a === 'start') { const o = choiceState.opts[choiceState.cursor]; mode = askReturn; choiceState = null; if (o.cb) o.cb(); return; }
      else if (a === 'b') { mode = askReturn; const last = choiceState.opts[choiceState.opts.length - 1]; choiceState = null; if (last && last.cancel) last.cb && last.cb(); return; }
    }
  }
  function openMenu() { menuState = { cursor: 0, items: ['TEAM', 'BAG', 'SAVE', 'SLIMEDEX', 'EXIT'] }; mode = 'menu'; }
  function menuUpdate() {
    for (const a of pressed) {
      if (a === 'up') menuState.cursor = (menuState.cursor + menuState.items.length - 1) % menuState.items.length;
      else if (a === 'down') menuState.cursor = (menuState.cursor + 1) % menuState.items.length;
      else if (a === 'b' || a === 'start') { mode = 'field'; return; }
      else if (a === 'a') {
        const it = menuState.items[menuState.cursor];
        if (it === 'TEAM') { teamState = { cursor: 0, ctx: 'field', pick: -1 }; mode = 'team'; }
        else if (it === 'BAG') openBag('field');
        else if (it === 'SAVE') ask('Save your journey?', [{ label: 'YES', cb: () => { saveGame(); say(['Saved to this device.']); } }, { label: 'NO', cb: () => { mode = 'menu'; } }]);
        else if (it === 'SLIMEDEX') { dexState = { scroll: 0 }; mode = 'dex'; }
        else if (it === 'EXIT') mode = 'field';
        return;
      }
    }
  }
  function teamUpdate() {
    const party = (B ? G.party : G.party);
    for (const a of pressed) {
      if (a === 'up') teamState.cursor = (teamState.cursor + party.length - 1) % party.length;
      else if (a === 'down') teamState.cursor = (teamState.cursor + 1) % party.length;
      else if (a === 'b') {
        if (teamState.ctx === 'battleSwitch' && teamState.forced) return;  // must choose
        mode = teamState.ctx === 'field' ? 'menu' : 'battle';
        if (mode === 'battle') B.phase = 'menu';
        teamState = null; return;
      }
      else if (a === 'a') {
        const m = party[teamState.cursor];
        if (teamState.ctx === 'battleSwitch') {
          if (m.hp <= 0) return;
          if (teamState.cursor === B.meIdx && !teamState.forced) return;
          const wasForced = teamState.forced; const idx = teamState.cursor; teamState = null;
          doSwitch(idx, wasForced); return;
        }
        if (teamState.ctx === 'itemTarget') { const idx = teamState.cursor; const itemId = teamState.item; const ret = teamState.ret; teamState = null; applyItemTo(itemId, idx, ret); return; }
        // field: tap to reorder (swap with leader)
        if (teamState.pick < 0) teamState.pick = teamState.cursor;
        else { const i = teamState.pick, j = teamState.cursor; const t = G.party[i]; G.party[i] = G.party[j]; G.party[j] = t; teamState.pick = -1; }
        return;
      }
    }
  }
  function openBag(ret) { const ids = bagIds(); bagState = { cursor: 0, ret, ids }; mode = 'bag'; }
  function bagIds() { return Object.keys(G.bag).filter(k => G.bag[k] > 0); }
  function bagUpdate() {
    if (!bagState) { mode = B ? 'battle' : 'field'; return; }
    const ids = bagState.ids = bagIds();
    if (!ids.length) { for (const a of pressed) if (a === 'b' || a === 'a') backFromBag(); return; }
    if (bagState.cursor >= ids.length) bagState.cursor = ids.length - 1;
    for (const a of pressed) {
      if (a === 'up') bagState.cursor = (bagState.cursor + ids.length - 1) % ids.length;
      else if (a === 'down') bagState.cursor = (bagState.cursor + 1) % ids.length;
      else if (a === 'b') { backFromBag(); return; }
      else if (a === 'a') { useBagItem(ids[bagState.cursor]); return; }
    }
  }
  function backFromBag() { if (bagState.ret === 'battle') { mode = 'battle'; B.phase = 'menu'; } else mode = 'menu'; bagState = null; }
  function useBagItem(id) {
    const it = ITEMS[id]; const ret = bagState.ret;
    if (it.kind === 'ball') {
      if (ret !== 'battle') { say(['Save that for the tall grass.']); sayReturn = 'bag'; return; }
      if (B.kind === 'trainer') { bagState = null; mode = 'battle'; B.phase = 'menu'; flash(['You can\'t catch another', 'trainer\'s slimémon!']); return; }
      bagState = null; mode = 'battle'; G.bag[id]--; throwBall(id); return;
    }
    // heal/cure/revive → pick a target
    teamState = { cursor: 0, ctx: 'itemTarget', item: id, ret }; mode = 'team';
  }
  function applyItemTo(id, idx, ret) {
    const it = ITEMS[id]; const m = G.party[idx]; let ok = false, note = '';
    if (it.kind === 'heal') { if (m.hp > 0 && m.hp < m.maxHp) { m.hp = Math.min(m.maxHp, m.hp + it.heal); ok = true; note = m.name + ' recovered HP!'; } else note = 'It would have no effect.'; }
    else if (it.kind === 'cure') { if (m.status && (it.cure === 'all' || it.cure === m.status)) { m.status = null; m.slpT = 0; ok = true; note = m.name + ' was cured!'; } else note = 'It would have no effect.'; }
    else if (it.kind === 'revive') { if (m.hp <= 0) { m.hp = Math.floor(m.maxHp / 2); m.status = null; ok = true; note = m.name + ' was revived!'; } else note = 'It would have no effect.'; }
    if (ok) G.bag[id]--;
    if (ret === 'battle') {
      mode = 'battle';
      if (ok) bsay([note], () => foeTurnThen(() => { B.phase = 'menu'; }));   // using an item costs your turn
      else { B.phase = 'menu'; flash([note]); }
    } else { say([note]); sayReturn = 'field'; }
  }
  function openShop() { shopState = { cursor: 0 }; mode = 'shop'; }
  function shopUpdate() {
    for (const a of pressed) {
      if (a === 'up') shopState.cursor = (shopState.cursor + SHOP.length - 1) % SHOP.length;
      else if (a === 'down') shopState.cursor = (shopState.cursor + 1) % SHOP.length;
      else if (a === 'b' || a === 'start') { mode = 'field'; shopState = null; return; }
      else if (a === 'a') {
        const id = SHOP[shopState.cursor], price = ITEMS[id].price;
        if (G.money >= price) { G.money -= price; G.bag[id] = (G.bag[id] || 0) + 1; vibe(6); flashMsg = ['Bought ' + ITEMS[id].name + '!']; }
        else flashMsg = ['Not enough cash.'];
        flashT = 900; return;
      }
    }
  }
  let flashMsg = null, flashT = 0;
  function flash(lines) { flashMsg = lines; flashT = 1100; }

  /* ===================== battle ===================== */
  function firstAlive() { for (let i = 0; i < G.party.length; i++) if (G.party[i].hp > 0) return i; return 0; }
  function aliveCount() { return G.party.filter(m => m.hp > 0).length; }
  function me() { return G.party[B.meIdx]; }
  function bsay(lines, after) { B.mq = (Array.isArray(lines) ? lines : [lines]).slice(); B.after = after || null; B.phase = 'msg'; }
  function bAdvance() { if (B.mq.length > 1) B.mq.shift(); else { B.mq = []; const cb = B.after; B.after = null; if (cb) cb(); } }

  function beginWild(foeMon) {
    B = { kind: 'wild', foe: foeMon, meIdx: firstAlive(), mq: [], after: null, phase: 'intro', menu: 0, move: 0, flee: 0, hurt: { me: 0, foe: 0 }, shake: 0 };
    seeDex(foeMon.sp); resetStages(foeMon); mode = 'battle';
    bsay(['A wild ' + foeMon.name + ' appeared!', 'Go! ' + me().name + '!'], () => { B.phase = 'menu'; });
  }
  function startTrainerBattle(n) {
    const team = n.team.map(([id, lv]) => makeMon(id, lv));
    B = { kind: 'trainer', trainer: n, tParty: team, tIdx: 0, foe: team[0], meIdx: firstAlive(), mq: [], after: null, phase: 'intro', menu: 0, move: 0, hurt: { me: 0, foe: 0 }, shake: 0 };
    seeDex(team[0].sp); mode = 'battle';
    bsay([n.name + ' wants to battle!', n.name + ' sent out ' + team[0].name + '!', 'Go! ' + me().name + '!'], () => { B.phase = 'menu'; });
  }

  const MENU = ['FIGHT', 'BAG', 'TEAM', 'RUN'];
  function battleUpdate(dt) {
    if (B.hurt.me > 0) B.hurt.me -= dt; if (B.hurt.foe > 0) B.hurt.foe -= dt;
    switch (B.phase) {
      case 'intro': case 'msg': for (const a of pressed) if (a === 'a' || a === 'start') { bAdvance(); break; } break;
      case 'menu':
        for (const a of pressed) {
          if (a === 'up' || a === 'down') B.menu = (B.menu + 2) % 4;
          else if (a === 'left' || a === 'right') B.menu = (B.menu % 2 === 0) ? B.menu + 1 : B.menu - 1;
          else if (a === 'a') {
            const sel = MENU[B.menu];
            if (sel === 'FIGHT') { B.phase = 'move'; B.move = 0; }
            else if (sel === 'BAG') openBag('battle');
            else if (sel === 'TEAM') { if (aliveCount() <= 1) { flash(['No one else can battle!']); } else { teamState = { cursor: 0, ctx: 'battleSwitch', forced: false }; mode = 'team'; } }
            else if (sel === 'RUN') attemptRun();
            return;
          }
        }
        break;
      case 'move':
        for (const a of pressed) {
          const mv = me().moves;
          if (a === 'b') { B.phase = 'menu'; return; }
          else if (a === 'up' || a === 'down') { const t = B.move ^ 2; if (t < mv.length) B.move = t; }
          else if (a === 'left' || a === 'right') { const t = B.move ^ 1; if (t < mv.length) B.move = t; }
          else if (a === 'a') { if (mv[B.move].pp <= 0) { flash(['No PP left for that move!']); return; } resolveTurn({ type: 'move', move: mv[B.move].id }); return; }
        }
        break;
    }
  }

  function attemptRun() {
    if (B.kind === 'trainer') { flash(['No running from a trainer!']); return; }
    B.flee++;
    const mySpe = effStat(me(), 'spe'), foeSpe = Math.max(1, effStat(B.foe, 'spe'));
    const odds = Math.floor((mySpe * 32) / (Math.floor(foeSpe / 4) % 256 || 1)) + 30 * B.flee;
    if (mySpe > foeSpe || odds > 255 || Math.floor(rng() * 256) < odds) { bsay(['Got away safe!'], () => endBattle('fled')); }
    else bsay(['Can\'t escape!'], () => foeTurnThen(() => { B.phase = 'menu'; }));
  }

  /* a single attack: mutates state, pushes message strings into `ev`, returns whether the defender fainted */
  function doMove(att, def, moveId, ev) {
    const mv = MOVES[moveId];
    // pre-move status gates
    if (att.status === 'slp') { if (att.slpT > 0) { att.slpT--; if (att.slpT <= 0) { att.status = null; ev.push(att.name + ' woke up!'); } else { ev.push(att.name + ' is fast asleep.'); return false; } if (att.status === null) { /* woke this turn → still loses it */ return false; } } }
    if (att.status === 'par' && chance(0.25)) { ev.push(att.name + ' is paralyzed! It can\'t move!'); return false; }
    if (att.cnfT > 0) { att.cnfT--; if (chance(0.33)) { const self = Math.max(1, Math.floor(((2 * att.lv / 5 + 2) * 40 * effStat(att, 'atk') / Math.max(1, effStat(att, 'def'))) / 50 + 2)); att.hp = Math.max(0, att.hp - self); ev.push(att.name + ' is confused! It hurt itself!'); return att.hp <= 0 ? false : false; } if (att.cnfT <= 0) ev.push(att.name + ' snapped out of confusion!'); }
    const pp = att.moves.find(m => m.id === moveId); if (pp) pp.pp = Math.max(0, pp.pp - 1);
    ev.push(att.name + ' used ' + mv.name + '!');
    // accuracy
    const accMul = stageMul(att.stages.acc || 0) / stageMul(def.stages.eva || 0);
    if (mv.acc && Math.floor(rng() * 100) >= mv.acc * accMul) { ev.push('It missed!'); return false; }
    if (mv.cat === 'stat') { applyStatMove(att, def, mv, ev); return def.hp <= 0; }
    // damage
    const r = calcDamage(att, def, moveId);
    def.hp = Math.max(0, def.hp - r.dmg);
    if (r.crit) ev.push('A critical hit!');
    if (r.mult > 1) ev.push('It\'s super effective!'); else if (r.mult < 1) ev.push('It\'s not very effective...');
    if (def === B.foe) B.hurt.foe = 220; else B.hurt.me = 220;
    if (mv.fx && mv.fx.recoil && r.dmg > 0) { const rc = Math.max(1, Math.floor(r.dmg * mv.fx.recoil)); att.hp = Math.max(0, att.hp - rc); ev.push(att.name + ' is hit by recoil!'); }
    if (def.hp > 0 && mv.fx) applySecondary(att, def, mv, ev);
    return def.hp <= 0;
  }
  function applyStatMove(att, def, mv, ev) {
    const fx = mv.fx || {};
    if (fx.heal) { const h = Math.floor(att.maxHp * fx.heal); att.hp = Math.min(att.maxHp, att.hp + h); ev.push(att.name + ' restored HP!'); }
    if (fx.status) { const t = fx.tgt === 'self' ? att : def; if (tryStatus(t, fx.status, ev)) { } }
    [fx.stat, fx.stat2].forEach(s => { if (!s) return; const t = s.tgt === 'self' ? att : def; bumpStage(t, s.k, s.n, ev); });
  }
  function applySecondary(att, def, mv, ev) {
    const fx = mv.fx; if (!fx) return;
    if (fx.status && (fx.chance == null || chance(fx.chance))) tryStatus(def, fx.status, ev);
    if (fx.stat && fx.tgt !== 'self' && (fx.chance == null || chance(fx.chance))) bumpStage(def, fx.stat.k, fx.stat.n, ev);
  }
  function tryStatus(t, st, ev) {
    if (st === 'cnf') { if (t.cnfT > 0) return false; t.cnfT = ri(2, 4); ev.push(t.name + ' became confused!'); return true; }
    if (t.status) return false;
    t.status = st; if (st === 'slp') t.slpT = ri(1, 3);
    ev.push(t.name + (st === 'psn' ? ' was poisoned!' : st === 'par' ? ' was paralyzed!' : st === 'brn' ? ' was burned!' : ' fell asleep!'));
    return true;
  }
  function bumpStage(t, k, n, ev) {
    const cur = t.stages[k] || 0; const nv = Math.max(-6, Math.min(6, cur + n));
    if (nv === cur) { ev.push(t.name + '\'s ' + k.toUpperCase() + ' won\'t change!'); return; }
    t.stages[k] = nv;
    ev.push(t.name + '\'s ' + k.toUpperCase() + (n > 0 ? ' rose' + (n >= 2 ? ' sharply' : '') : ' fell' + (n <= -2 ? ' harshly' : '')) + '!');
  }
  function endTurnStatus(m, ev) {
    if (m.hp <= 0) return;
    if (m.status === 'psn') { const d = Math.max(1, Math.floor(m.maxHp / 8)); m.hp = Math.max(0, m.hp - d); ev.push(m.name + ' is hurt by poison!'); }
    else if (m.status === 'brn') { const d = Math.max(1, Math.floor(m.maxHp / 16)); m.hp = Math.max(0, m.hp - d); ev.push(m.name + ' is hurt by its burn!'); }
  }

  function aiPick(foe, target) {
    const usable = foe.moves.filter(m => m.pp > 0);
    if (!usable.length) return 'tackle';
    let best = usable[0], bestScore = -1;
    for (const mv of usable) {
      const M = MOVES[mv.id]; let score;
      if (M.cat === 'stat') score = 6 + rng() * 6;
      else { const r = calcDamage(foe, target, mv.id); score = r.dmg * (r.mult >= 2 ? 1.3 : 1) + rng() * 4; }
      if (score > bestScore) { bestScore = score; best = mv; }
    }
    // a little unpredictability so the AI isn't perfectly greedy
    if (chance(0.2)) best = pick(usable);
    return best.id;
  }

  function resolveTurn(playerAction) {
    const ev = [];
    const myMon = me(), foe = B.foe;
    const foeMoveId = aiPick(foe, myMon);
    const myFirst = effStat(myMon, 'spe') > effStat(foe, 'spe') || (effStat(myMon, 'spe') === effStat(foe, 'spe') && chance(0.5));
    const order = myFirst ? ['me', 'foe'] : ['foe', 'me'];
    let ended = false;
    for (const who of order) {
      if (ended) break;
      if (who === 'me') {
        if (myMon.hp <= 0 || foe.hp <= 0) continue;
        if (doMove(myMon, foe, playerAction.move, ev)) { ended = true; }
      } else {
        if (foe.hp <= 0 || myMon.hp <= 0) continue;
        if (doMove(foe, myMon, foeMoveId, ev)) { ended = true; }
      }
    }
    if (!ended) { endTurnStatus(myMon, ev); endTurnStatus(foe, ev); }
    // route based on outcome
    bsay(ev, () => routeAfterTurn());
  }
  function foeTurnThen(after) {
    const ev = []; const myMon = me(), foe = B.foe;
    if (foe.hp > 0 && myMon.hp > 0) doMove(foe, myMon, aiPick(foe, myMon), ev);
    if (myMon.hp > 0 && foe.hp > 0) { endTurnStatus(myMon, ev); endTurnStatus(foe, ev); }
    bsay(ev.length ? ev : ['...'], () => { B._after = after; routeAfterTurn(after); });
  }
  function routeAfterTurn(forcedAfter) {
    const myMon = me(), foe = B.foe;
    if (foe.hp <= 0) { onFoeFaint(); return; }
    if (myMon.hp <= 0) { onMeFaint(); return; }
    if (forcedAfter) { forcedAfter(); return; }
    B.phase = 'menu';
  }

  function onFoeFaint() {
    const foe = B.foe, ev = [foe.name + ' fainted!'];
    const part = me();
    const expMsgs = part.hp > 0 ? gainExp(part, foe, B.kind === 'trainer') : [];
    if (B.kind === 'trainer') {
      B.tIdx++;
      if (B.tIdx < B.tParty.length) {
        bsay([...ev, ...expMsgs, B.trainer.name + ' sent out ' + B.tParty[B.tIdx].name + '!'], () => { B.foe = B.tParty[B.tIdx]; resetStages(B.foe); seeDex(B.foe.sp); B.phase = 'menu'; });
      } else {
        bsay([...ev, ...expMsgs, ...(B.trainer.lose || ['You won!'])], () => trainerWin());
      }
    } else {
      bsay([...ev, ...expMsgs], () => endBattle('won'));
    }
  }
  function trainerWin() {
    const n = B.trainer; n.beaten = true;
    G.money += n.reward || 0;
    const msgs = ['You beat ' + n.name + '!', 'Got $' + (n.reward || 0) + '!'];
    if (n.leader) { G.badges = Math.max(G.badges, 1); msgs.push('You earned the FANG BADGE!'); }
    saveGame();
    bsay(msgs, () => endBattle('won'));
  }
  function onMeFaint() {
    const ev = [me().name + ' fainted!'];
    if (aliveCount() > 0) { bsay(ev, () => { teamState = { cursor: firstAlive(), ctx: 'battleSwitch', forced: true }; mode = 'team'; }); }
    else { bsay([...ev, 'You whited out!'], () => whiteout()); }
  }
  function doSwitch(idx, wasForced) {
    B.meIdx = idx; mode = 'battle'; resetStages(me());
    if (wasForced) { bsay(['Go! ' + me().name + '!'], () => { B.phase = 'menu'; }); }
    else { bsay(['Come back! Go, ' + me().name + '!'], () => foeTurnThen(() => { B.phase = 'menu'; })); }
  }
  function throwBall(id) {
    const it = ITEMS[id]; B.phase = 'msg';
    const res = tryCatch(B.foe, it.bonus);
    const ev = ['You threw a ' + it.name + '!'];
    for (let i = 0; i < res.shakes && i < 3; i++) ev.push('...');
    if (res.caught) {
      catchDex(B.foe.sp);
      const where = addMon(makeCaught(B.foe));
      ev.push('Gotcha! ' + B.foe.name + ' was caught!');
      if (where === 'box') ev.push('It was sent to the SB BOX.');
      bsay(ev, () => endBattle('caught'));
    } else {
      ev.push(res.shakes >= 2 ? 'Argh! So close!' : res.shakes >= 1 ? 'Aww! It broke free!' : 'Oh no! It dodged the ball!');
      bsay(ev, () => foeTurnThen(() => { B.phase = 'menu'; }));
    }
  }
  function makeCaught(foe) {
    const m = makeMon(foe.sp, foe.lv, { moves: foe.moves.map(x => ({ id: x.id, pp: x.pp, max: x.max })) });
    m.hp = foe.hp; m.status = foe.status; m.exp = foe.exp; return m;
  }
  function whiteout() {
    healParty();
    const rp = (G && G.respawn) || { map: 'town', x: 9, y: 6 };
    endBattle('lost');
    fadeOut(() => { G.map = rp.map; G.px = rp.x; G.py = rp.y; walkT = 0; snapCam(); say(['You scrambled back to safety.', 'Your team was patched up.']); });
  }
  function endBattle(result) {
    if (B) B.result = result;
    B = null; mode = 'field';
    if (bagState) bagState = null;
  }

  /* ===================== combat math (testable) ===================== */
  function calcDamage(att, def, moveId) {
    const m = MOVES[moveId]; const types = DEX[def.sp].types;
    const mult = effMulti(m.type, types);
    if (m.cat === 'stat' || !m.pow) return { dmg: 0, mult, crit: false };
    const crit = chance(1 / 16);
    const A = m.cat === 'phys' ? effStat(att, 'atk') : effStat(att, 'spa');
    const D = m.cat === 'phys' ? effStat(def, 'def') : effStat(def, 'spd');
    let base = Math.floor(Math.floor(Math.floor((2 * att.lv / 5 + 2) * m.pow * A / Math.max(1, D)) / 50) + 2);
    const stab = DEX[att.sp].types.includes(m.type) ? 1.5 : 1;
    let dmg = base * stab * mult * (crit ? 1.5 : 1);
    dmg = Math.floor(dmg * (217 + Math.floor(rng() * 39)) / 255);
    if (mult > 0) dmg = Math.max(1, dmg);
    return { dmg, mult, crit };
  }
  function tryCatch(foe, ballBonus) {
    if (ballBonus >= 255) return { caught: true, shakes: 4 };
    const maxHp = foe.maxHp, cur = Math.max(1, foe.hp), rate = DEX[foe.sp].catch;
    let a = ((3 * maxHp - 2 * cur) * rate * ballBonus) / (3 * maxHp);
    if (foe.status === 'slp') a *= 2; else if (foe.status) a *= 1.5;
    a = Math.max(1, Math.floor(a));
    if (a >= 255) return { caught: true, shakes: 4 };
    const b = Math.floor(1048560 / Math.max(1, Math.floor(Math.sqrt(Math.floor(Math.sqrt(Math.floor(16711680 / a)))))));
    let shakes = 0;
    for (let i = 0; i < 4; i++) { if (Math.floor(rng() * 65536) < b) shakes++; else break; }
    return { caught: shakes >= 4, shakes };
  }
  function gainExp(mon, foe, trainer) {
    let gain = Math.max(1, Math.floor(DEX[foe.sp].exp * foe.lv / 7 * (trainer ? 1.5 : 1)));
    const msgs = [mon.name + ' gained ' + gain + ' EXP!']; mon.exp += gain;
    let guard = 100;
    while (mon.lv < 100 && mon.exp >= (mon.lv + 1) ** 3 && guard-- > 0) {
      mon.lv++; const oldMax = mon.maxHp; mon.maxHp = statAt(DEX[mon.sp].base[0], mon.lv, true); mon.hp += (mon.maxHp - oldMax);
      msgs.push(mon.name + ' grew to Lv' + mon.lv + '!');
      for (const [l, mvId] of DEX[mon.sp].learn) if (l === mon.lv) msgs.push(...learnMove(mon, mvId));
      const evo = DEX[mon.sp].evo; if (evo && mon.lv >= evo.lv) msgs.push(...evolveMon(mon, evo.to));
    }
    return msgs;
  }
  function learnMove(mon, mvId) {
    if (mon.moves.find(x => x.id === mvId)) return [];
    if (mon.moves.length < 4) { mon.moves.push({ id: mvId, pp: MOVES[mvId].pp, max: MOVES[mvId].pp }); return [mon.name + ' learned ' + MOVES[mvId].name + '!']; }
    const old = mon.moves[0].id; mon.moves.shift(); mon.moves.push({ id: mvId, pp: MOVES[mvId].pp, max: MOVES[mvId].pp });
    return [mon.name + ' forgot ' + MOVES[old].name + ',', 'and learned ' + MOVES[mvId].name + '!'];
  }
  function evolveMon(mon, toId) {
    const oldName = mon.name; mon.sp = toId; mon.name = DEX[toId].name;
    const oldMax = mon.maxHp; mon.maxHp = statAt(DEX[toId].base[0], mon.lv, true); mon.hp += (mon.maxHp - oldMax);
    catchDex(toId); return ['Huh? ' + oldName + ' is evolving!', oldName + ' evolved into ' + DEX[toId].name + '!'];
  }

  /* ===================== camera + transitions ===================== */
  function snapCam() { const mp = mapPx(G.map); cam.x = clampCam(G.px * TILE + 8 - VW / 2, mp.w, VW); cam.y = clampCam(G.py * TILE + 8 - VH / 2, mp.h, VH); }
  function clampCam(v, mapDim, viewDim) { if (mapDim <= viewDim) return Math.floor((mapDim - viewDim) / 2); return Math.max(0, Math.min(mapDim - viewDim, v)); }
  function fadeOut(cb) { fade = 1; fadeTo = 1; fadeCb = cb; }

  /* ===================== render ===================== */
  function S() { ctx.setTransform(scale, 0, 0, scale, offX, offY); }
  function clearAll(col) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height); S(); ctx.fillStyle = col || C.ink2; ctx.fillRect(0, 0, VW, VH); }
  function text(s, x, y, opt) {
    opt = opt || {}; const size = opt.size || 8;
    ctx.font = '700 ' + size + 'px ' + FONT; ctx.textBaseline = 'top'; ctx.textAlign = opt.align || 'left';
    if (opt.shadow !== false) { ctx.fillStyle = opt.sh || 'rgba(0,0,0,.65)'; ctx.fillText(s, x + 1, y + 1); }
    ctx.fillStyle = opt.col || C.bone; ctx.fillText(s, x, y);
  }
  function charW(size) { return size * 0.6; }
  function wrapLines(s, maxChars) {
    const out = []; for (const para of String(s).split('\n')) { const words = para.split(' '); let cur = ''; for (const w of words) { if ((cur ? cur + ' ' + w : w).length > maxChars) { if (cur) out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } out.push(cur); } return out;
  }
  function panel(x, y, w, h, col, border) {
    ctx.fillStyle = col || C.box; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = border || C.slime; ctx.lineWidth = 1.5; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = 'rgba(141,255,43,.25)'; ctx.lineWidth = 1; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
  }
  function msgbox(lines) {
    const h = 46, y = VH - h; panel(2, y, VW - 4, h - 2);
    const arr = Array.isArray(lines) ? lines : wrapLines(lines, 32);
    for (let i = 0; i < Math.min(3, arr.length); i++) text(arr[i], 10, y + 8 + i * 12, { size: 9 });
    if (blink % 800 < 500) text('▼', VW - 14, y + h - 14, { size: 8, col: C.slime, shadow: false });
  }
  function bar(x, y, w, frac, col, bg) { ctx.fillStyle = bg || '#10210a'; ctx.fillRect(x, y, w, 4); ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(0, Math.round(w * frac)), 4); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.strokeRect(x - .5, y - .5, w + 1, 5); }
  function hpCol(frac) { return frac > 0.5 ? C.slime : frac > 0.2 ? C.gold : C.rage; }

  /* --- tiles --- */
  function drawTile(ch, sx, sy, map) {
    const interior = MAPS[map].interior;
    if (interior && (ch === '_' || ch === 'M' || ch === '=' || ch === 'b' || ch === 'P')) {
      ctx.fillStyle = '#16121f'; ctx.fillRect(sx, sy, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fillRect(sx, sy, TILE, 1);
    }
    switch (ch) {
      case 'T': ctx.fillStyle = '#0c2e10'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#1f6e10'; ctx.beginPath(); ctx.arc(sx + 8, sy + 7, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#2a7a00'; ctx.beginPath(); ctx.arc(sx + 6, sy + 5, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.fillRect(sx + 7, sy + 12, 2, 4); break;
      case 'W': ctx.fillStyle = '#0d3a6b'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#1f6bb5'; ctx.fillRect(sx + 2, sy + 4 + (blink % 1200 < 600 ? 0 : 2), 5, 1); ctx.fillRect(sx + 9, sy + 9 - (blink % 1200 < 600 ? 0 : 2), 5, 1); break;
      case '#': ctx.fillStyle = '#2a2f26'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#3c4435'; ctx.fillRect(sx + 1, sy + 1, 6, 6); ctx.fillRect(sx + 9, sy + 9, 5, 5); break;
      case 'R': ctx.fillStyle = '#6e1224'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#8a1c30'; ctx.fillRect(sx, sy, TILE, 3); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(sx, sy + TILE - 2, TILE, 2); break;
      case 'H': ctx.fillStyle = '#3a3340'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#473e50'; ctx.fillRect(sx + 1, sy + 1, TILE - 2, 6); break;
      case 'D': ctx.fillStyle = interior ? '#16121f' : '#3a3340'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#1a0f06'; ctx.fillRect(sx + 4, sy + 3, 8, 13); ctx.fillStyle = C.gold; ctx.fillRect(sx + 9, sy + 9, 1, 2); break;
      case 'S': ctx.fillStyle = MAPS[map].interior ? '#16121f' : '#1f6e10'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(sx + 3, sy + 4, 10, 7); ctx.fillStyle = '#caa46a'; ctx.fillRect(sx + 4, sy + 5, 8, 5); ctx.fillStyle = '#3a2410'; ctx.fillRect(sx + 6, sy + 11, 1, 4); ctx.fillRect(sx + 9, sy + 11, 1, 4); break;
      case 'G': ctx.fillStyle = '#16400e'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#2a7a00'; for (let i = 0; i < 4; i++) { const gx = sx + 2 + i * 4; ctx.fillRect(gx, sy + 8, 1, 6); ctx.fillRect(gx - 1, sy + 10, 1, 4); ctx.fillRect(gx + 1, sy + 10, 1, 4); } break;
      case 'f': ground(sx, sy); ctx.fillStyle = C.gold; ctx.fillRect(sx + 6, sy + 6, 3, 3); ctx.fillStyle = C.rage; ctx.fillRect(sx + 7, sy + 7, 1, 1); break;
      case ',': ground(sx, sy); break;
      case '.': ctx.fillStyle = '#caa46a'; ctx.fillRect(sx, sy, TILE, TILE); break;
      case '=': ctx.fillStyle = '#2a1f3a'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#473055'; ctx.fillRect(sx, sy + 2, TILE, TILE - 4); ctx.fillStyle = C.slime; ctx.fillRect(sx, sy + TILE - 3, TILE, 1); break;
      case 'b': ctx.fillStyle = '#241c30'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#3a2e4a'; ctx.fillRect(sx + 1, sy + 2, TILE - 2, 3); ctx.fillRect(sx + 1, sy + 8, TILE - 2, 3); break;
      case 'M': ctx.fillStyle = '#16121f'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#2a7a00'; ctx.fillRect(sx + 2, sy + 2, TILE - 4, TILE - 4); ctx.fillStyle = C.slime; ctx.fillRect(sx + 4, sy + 4, TILE - 8, TILE - 8); break;
      case 'P': break;  // prop tile (NPC/starter drawn on top); floor already painted above
      case ' ': default: if (!interior) { ctx.fillStyle = '#06120a'; ctx.fillRect(sx, sy, TILE, TILE); } break;
    }
  }
  function ground(sx, sy) { ctx.fillStyle = '#1c5a16'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#1f6e10'; ctx.fillRect(sx + 3, sy + 4, 1, 1); ctx.fillRect(sx + 11, sy + 9, 1, 1); ctx.fillRect(sx + 7, sy + 13, 1, 1); }

  function drawPerson(sx, sy, sprite, dir, frame) {
    const P = SPRITES[sprite] || SPRITES.rival;
    const bob = frame ? -1 : 0;
    // body
    ctx.fillStyle = P.body; ctx.fillRect(sx + 4, sy + 7 + bob, 8, 6);
    // legs
    ctx.fillStyle = P.body2 || P.body; if (frame) { ctx.fillRect(sx + 4, sy + 13 + bob, 3, 3); ctx.fillRect(sx + 9, sy + 12 + bob, 3, 3); } else { ctx.fillRect(sx + 4, sy + 12 + bob, 3, 3); ctx.fillRect(sx + 9, sy + 13 + bob, 3, 3); }
    // head
    ctx.fillStyle = C.skin; ctx.fillRect(sx + 5, sy + 2 + bob, 6, 6);
    ctx.fillStyle = P.hair; ctx.fillRect(sx + 4, sy + 1 + bob, 8, 3);
    // face by direction
    ctx.fillStyle = '#0a0a0a';
    if (dir === 'd' || dir === 'down') { ctx.fillRect(sx + 6, sy + 5 + bob, 1, 1); ctx.fillRect(sx + 9, sy + 5 + bob, 1, 1); }
    else if (dir === 'u' || dir === 'up') { ctx.fillStyle = P.hair; ctx.fillRect(sx + 5, sy + 2 + bob, 6, 4); }
    else if (dir === 'l' || dir === 'left') { ctx.fillRect(sx + 6, sy + 5 + bob, 1, 1); }
    else { ctx.fillRect(sx + 9, sy + 5 + bob, 1, 1); }
    if (P.cap) { ctx.fillStyle = P.cap; ctx.fillRect(sx + 4, sy + bob, 8, 2); }
  }
  const SPRITES = {
    rival: { body: '#3a3a4a', body2: '#222230', hair: '#1a1208', cap: C.slime },
    mom: { body: '#7a4a9a', body2: '#4a2a60', hair: '#3a2410' },
    prof: { body: '#cfd6df', body2: '#9aa2ad', hair: '#cfd6df' },
    nurse: { body: '#ff6f9c', body2: '#c44a72', hair: '#ff9ec0', cap: '#ffffff' },
    clerk: { body: '#2a6ed8', body2: '#184a9c', hair: '#1a1208' },
    scout: { body: '#5a8a2a', body2: '#3a5a18', hair: '#caa46a', cap: '#caa46a' },
    rapper: { body: '#1a1a22', body2: '#0a0a10', hair: '#0a0a0a', cap: C.gold },
    biker: { body: '#2a2a2a', body2: '#101010', hair: '#1a1208', cap: C.rage },
    viper: { body: '#6e0411', body2: '#3a020a', hair: '#0a0a0a', cap: C.toxic },
  };

  /* --- creature art (procedural, themed per archetype + palette) --- */
  function drawMon(sp, cx, cy, sz, back, t) {
    const d = DEX[sp]; const [c1, c2, c3] = d.col; const arch = d.arch;
    const wob = Math.sin((t || 0) / 260) * (sz * 0.03);
    ctx.save(); ctx.translate(cx, cy + wob);
    const r = sz / 2;
    function blob(rad, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, rad, rad * 0.92, 0, 0, 7); ctx.fill(); }
    function eyes(off) { if (back) return; ctx.fillStyle = '#fff'; ctx.fillRect(-r * 0.34, -r * 0.18, r * 0.22, r * 0.26); ctx.fillRect(r * 0.12, -r * 0.18, r * 0.22, r * 0.26); ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-r * 0.28 + (off || 0), -r * 0.10, r * 0.10, r * 0.14); ctx.fillRect(r * 0.18 + (off || 0), -r * 0.10, r * 0.10, r * 0.14); }
    if (arch === 'blob') { blob(r, c2); blob(r * 0.86, c1); ctx.fillStyle = c3; ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.4, r * 0.3, r * 0.18, 0, 0, 7); ctx.fill(); eyes(); ctx.fillStyle = '#0a0a0a'; if (!back) { ctx.fillRect(-r * 0.12, r * 0.12, r * 0.24, r * 0.06); } }
    else if (arch === 'serpent') { ctx.strokeStyle = c2; ctx.lineWidth = r * 0.5; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i <= 10; i++) { const a = i / 10; const x = (a - 0.5) * sz; const y = Math.sin(a * 6 + (t || 0) / 200) * r * 0.4 + r * 0.3; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(-r * 0.6, -r * 0.2, r * 0.5, 0, 7); ctx.fill(); ctx.fillStyle = c3; ctx.beginPath(); ctx.arc(-r * 0.6, -r * 0.2, r * 0.5, 0, 3.14); ctx.fill(); if (!back) { ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-r * 0.78, -r * 0.34, 2, 2); ctx.fillStyle = c3; ctx.fillRect(-r * 1.0, -r * 0.1, r * 0.3, 1); } }
    else if (arch === 'bug') { blob(r * 0.8, c2); ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(-r * 0.7, -r * 0.2, r * 0.5, r * 0.7, -0.4, 0, 7); ctx.ellipse(r * 0.7, -r * 0.2, r * 0.5, r * 0.7, 0.4, 0, 7); ctx.fill(); ctx.fillStyle = c3; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, 7); ctx.fill(); eyes(); ctx.strokeStyle = c1; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.5); ctx.lineTo(-r * 0.3, -r * 0.9); ctx.moveTo(r * 0.1, -r * 0.5); ctx.lineTo(r * 0.3, -r * 0.9); ctx.stroke(); }
    else if (arch === 'beast') { ctx.fillStyle = c2; ctx.fillRect(-r * 0.7, -r * 0.2, sz * 0.7, r * 0.9); blob(r * 0.6, c1); ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.1, r * 0.5, 0, 7); ctx.fill(); ctx.fillStyle = c3; ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.5); ctx.lineTo(r * 0.5, -r * 0.95); ctx.lineTo(r * 0.7, -r * 0.5); ctx.fill(); if (!back) { ctx.fillStyle = '#0a0a0a'; ctx.fillRect(r * 0.45, -r * 0.2, 2, 2); } ctx.strokeStyle = c2; ctx.lineWidth = r * 0.18; ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.5); ctx.lineTo(-r * 0.9, r * 0.1); ctx.stroke(); }
    else if (arch === 'wisp') { ctx.globalAlpha = 0.85; blob(r, c2); ctx.globalAlpha = 1; blob(r * 0.66, c1); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + (t || 0) / 300; ctx.fillStyle = c3; ctx.fillRect(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1, 2, 2); } eyes(); }
    else if (arch === 'golem') { ctx.fillStyle = c2; ctx.fillRect(-r * 0.8, -r * 0.7, sz * 0.8, sz * 0.85); ctx.fillStyle = c1; ctx.fillRect(-r * 0.6, -r * 0.5, sz * 0.6, sz * 0.62); ctx.fillStyle = c3; ctx.fillRect(-r * 0.6, r * 0.2, sz * 0.6, 3); if (!back) { ctx.fillStyle = '#fff'; ctx.fillRect(-r * 0.3, -r * 0.2, 3, 3); ctx.fillRect(r * 0.1, -r * 0.2, 3, 3); ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-r * 0.28, -r * 0.18, 1, 2); ctx.fillRect(r * 0.12, -r * 0.18, 1, 2); } }
    else { blob(r, c1); eyes(); }
    ctx.restore();
  }

  /* --- scenes --- */
  function renderField() {
    // camera (smooth toward player; immediate enough for grid)
    const mp = mapPx(G.map);
    let pxx = G.px * TILE, pyy = G.py * TILE;
    if (walkT > 0 && stepFrom) { const p = 1 - walkT / STEP_MS; pxx = (stepFrom.x + (G.px - stepFrom.x) * p) * TILE; pyy = (stepFrom.y + (G.py - stepFrom.y) * p) * TILE; }
    cam.x = clampCam(Math.round(pxx + 8 - VW / 2), mp.w, VW);
    cam.y = clampCam(Math.round(pyy + 8 - VH / 2), mp.h, VH);
    clearAll(MAPS[G.map].interior ? '#0c0a12' : '#06120a');
    const x0 = Math.floor(cam.x / TILE), y0 = Math.floor(cam.y / TILE);
    for (let ty = y0; ty <= y0 + 11; ty++) for (let tx = x0; tx <= x0 + 16; tx++) {
      const ch = tileAt(G.map, tx, ty); const sx = tx * TILE - cam.x, sy = ty * TILE - cam.y;
      drawTile(ch, sx, sy, G.map);
    }
    // npcs
    for (const n of (MAPS[G.map].npcs || [])) { if (n._gone) continue; drawPerson(n.x * TILE - cam.x, n.y * TILE - cam.y, n.sprite, n.dir, 0); }
    // starter balls
    for (const s of (MAPS[G.map].starters || [])) { const sx = s.x * TILE - cam.x, sy = s.y * TILE - cam.y; ctx.fillStyle = C.slime; ctx.beginPath(); ctx.arc(sx + 8, sy + 9, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(sx + 5, sy + 8, 6, 1); ctx.fillStyle = '#0a0a0a'; ctx.fillRect(sx + 7, sy + 8, 2, 1); }
    // player
    drawPerson(Math.round(pxx - cam.x), Math.round(pyy - cam.y), 'rival', faceLetter[G.dir], walkT > 0 ? (Math.floor((1 - walkT / STEP_MS) * 2) % 2) : 0);
    // location banner (brief)
    text(MAPS[G.map].name, 6, 5, { size: 9, col: C.slime });
    if (flashT > 0) { flashT -= 16; msgbox(flashMsg); }
  }

  function renderBattle() {
    clearAll('#0a1410');
    // sky / floor
    let g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#10301a'); g.addColorStop(1, '#06120a'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH - 46);
    // platforms
    ctx.fillStyle = 'rgba(141,255,43,.10)'; ctx.beginPath(); ctx.ellipse(VW - 56, 78, 44, 12, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(58, 116, 50, 14, 0, 0, 7); ctx.fill();
    // foe + my mon
    const foeShake = B.hurt.foe > 0 && (blink % 80 < 40) ? 2 : 0;
    const meShake = B.hurt.me > 0 && (blink % 80 < 40) ? 2 : 0;
    if (B.foe.hp > 0 || B.phase !== 'msg') drawMon(B.foe.sp, VW - 56 + foeShake, 60, 34, false, anim);
    drawMon(me().sp, 58 + meShake, 96, 44, true, anim);
    // foe HP box (top-left)
    statusBox(8, 10, B.foe, false);
    // my HP box (bottom-right)
    statusBox(VW - 118, 70, me(), true);
    // bottom UI
    if (B.phase === 'menu') {
      panel(2, VH - 46, VW - 4, 44);
      text('What will', 8, VH - 40, { size: 9 }); text(me().name + ' do?', 8, VH - 28, { size: 9 });
      const bx = 120, by = VH - 42;
      for (let i = 0; i < 4; i++) { const cx = bx + (i % 2) * 56, cy = by + Math.floor(i / 2) * 16; text((B.menu === i ? '▶ ' : '  ') + MENU[i], cx, cy, { size: 9, col: B.menu === i ? C.slime : C.bone }); }
    } else if (B.phase === 'move') {
      panel(2, VH - 46, VW - 4, 44);
      const mv = me().moves;
      for (let i = 0; i < mv.length; i++) { const cx = 8 + (i % 2) * 96, cy = VH - 40 + Math.floor(i / 2) * 14; const sel = B.move === i; text((sel ? '▶' : ' ') + MOVES[mv[i].id].name, cx, cy, { size: 9, col: sel ? C.slime : C.bone }); }
      const cur = mv[B.move]; text(MOVES[cur.id].type + '  PP ' + cur.pp + '/' + cur.max, VW - 96, VH - 12, { size: 8, col: TYPECOL[MOVES[cur.id].type] });
    } else {
      msgbox(B.mq[0] || '');
    }
    if (flashT > 0) { flashT -= 16; panel(20, 50, VW - 40, 30); const a = Array.isArray(flashMsg) ? flashMsg : [flashMsg]; for (let i = 0; i < a.length; i++) text(a[i], VW / 2, 58 + i * 12, { size: 9, align: 'center' }); }
  }
  function statusBox(x, y, m, mine) {
    const w = 110, h = mine ? 32 : 26; panel(x, y, w, h, '#08140b');
    text(m.name, x + 6, y + 4, { size: 9 }); text('Lv' + m.lv, x + w - 26, y + 4, { size: 9, col: C.gold });
    if (m.status) { text(m.status.toUpperCase(), x + 6, y + h - 9, { size: 7, col: statusCol(m.status) }); }
    bar(x + 24, y + 16, w - 32, m.hp / m.maxHp, hpCol(m.hp / m.maxHp));
    text('HP', x + 6, y + 13, { size: 7, col: C.slime });
    if (mine) { text(m.hp + '/' + m.maxHp, x + w - 6, y + 22, { size: 8, align: 'right' }); const need = (m.lv + 1) ** 3 - m.lv ** 3, have = m.exp - m.lv ** 3; bar(x + 6, y + h - 3, w - 12, Math.max(0, Math.min(1, have / need)), C.blue, '#0a1430'); }
  }
  function statusCol(s) { return s === 'psn' ? C.purple : s === 'par' ? C.gold : s === 'brn' ? C.rage : s === 'slp' ? C.blue : C.cyan; }

  function renderTitle() {
    clearAll('#04060a');
    let g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#0c2e10'); g.addColorStop(1, '#04060a'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    drawMon('hisslet', 200, 36, 34, false, anim); drawMon('driplet', 40, 40, 30, false, anim + 400);
    text('SLIMÉMON', VW / 2, 44, { size: 26, col: C.slime, align: 'center' });
    text('VENOM & VERSE', VW / 2, 72, { size: 9, col: C.toxic, align: 'center' });
    const opts = titleOpts();
    panel(VW / 2 - 50, 92, 100, 16 + opts.length * 12);
    for (let i = 0; i < opts.length; i++) text((titleCursor === i ? '▶ ' : '   ') + opts[i], VW / 2 - 40, 100 + i * 12, { size: 10, col: titleCursor === i ? C.slime : C.bone });
    if (blink % 1000 < 600) text('SLIME BY · pocket RPG', VW / 2, VH - 12, { size: 8, col: C.dim, align: 'center' });
  }
  function titleOpts() { return hasSave() ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME']; }
  function titleUpdate() {
    const opts = titleOpts();
    for (const a of pressed) {
      if (a === 'up') titleCursor = (titleCursor + opts.length - 1) % opts.length;
      else if (a === 'down') titleCursor = (titleCursor + 1) % opts.length;
      else if (a === 'a' || a === 'start') {
        const o = opts[titleCursor];
        if (o === 'CONTINUE') { if (continueGame()) { mode = 'field'; snapCam(); } }
        else { newGame(); mode = 'field'; snapCam(); say(['SLIMÉMON!', 'Prof. Drip is waiting in the lab below.', 'Head into town and pick a partner.']); }
        return;
      }
    }
  }

  function renderMenu() {
    renderField();
    const w = 92, x = VW - w - 4, y = 4; panel(x, y, w, 8 + menuState.items.length * 12);
    for (let i = 0; i < menuState.items.length; i++) text((menuState.cursor === i ? '▶' : ' ') + menuState.items[i], x + 6, y + 6 + i * 12, { size: 9, col: menuState.cursor === i ? C.slime : C.bone });
  }
  function renderTeam() {
    if (!B) renderField(); else renderBattle();
    panel(6, 6, VW - 12, VH - 12);
    text('TEAM', 14, 12, { size: 10, col: C.slime });
    const party = G.party;
    for (let i = 0; i < party.length; i++) {
      const m = party[i], y = 26 + i * 20, sel = teamState.cursor === i;
      ctx.fillStyle = sel ? 'rgba(141,255,43,.12)' : 'rgba(0,0,0,.2)'; ctx.fillRect(10, y - 2, VW - 20, 18);
      if (teamState.pick === i) { ctx.strokeStyle = C.gold; ctx.strokeRect(10, y - 2, VW - 20, 18); }
      drawMon(m.sp, 22, y + 8, 16, false, anim + i * 100);
      text(m.name, 36, y, { size: 9, col: m.hp > 0 ? C.bone : C.rage });
      text('Lv' + m.lv, 110, y, { size: 8, col: C.gold });
      bar(140, y + 4, 60, m.hp / m.maxHp, hpCol(m.hp / m.maxHp));
      text(m.hp + '/' + m.maxHp, 205, y, { size: 7 });
      if (m.status) text(m.status.toUpperCase(), 36, y + 9, { size: 6, col: statusCol(m.status) });
    }
    const hint = teamState.ctx === 'battleSwitch' ? (teamState.forced ? 'A: send out' : 'A: switch  B: back') : teamState.ctx === 'itemTarget' ? 'A: use on  B: cancel' : 'A: reorder  B: back';
    text(hint, 14, VH - 16, { size: 8, col: C.dim });
  }
  function renderBag() {
    if (bagState.ret === 'battle') renderBattle(); else renderField();
    panel(6, 6, VW - 12, VH - 12);
    text('BAG', 14, 12, { size: 10, col: C.slime });
    text('$' + (G ? G.money : 0), VW - 14, 12, { size: 9, col: C.gold, align: 'right' });
    const ids = bagState.ids;
    if (!ids.length) { text('Empty.', 16, 30, { size: 9, col: C.dim }); }
    for (let i = 0; i < ids.length; i++) { const id = ids[i], sel = bagState.cursor === i, y = 28 + i * 13; text((sel ? '▶' : ' ') + ITEMS[id].name, 14, y, { size: 9, col: sel ? C.slime : C.bone }); text('x' + G.bag[id], VW - 16, y, { size: 9, align: 'right' }); }
    const cur = ids[bagState.cursor]; if (cur) { panel(6, VH - 30, VW - 12, 26); wrapLines(ITEMS[cur].desc, 40).slice(0, 2).forEach((l, i) => text(l, 12, VH - 25 + i * 10, { size: 8, col: C.dim })); }
  }
  function renderShop() {
    renderField();
    panel(6, 6, VW - 12, VH - 12);
    text('SB SHOP', 14, 12, { size: 10, col: C.slime }); text('$' + G.money, VW - 14, 12, { size: 9, col: C.gold, align: 'right' });
    for (let i = 0; i < SHOP.length; i++) { const id = SHOP[i], sel = shopState.cursor === i, y = 28 + i * 13; text((sel ? '▶' : ' ') + ITEMS[id].name, 14, y, { size: 9, col: sel ? C.slime : C.bone }); text('$' + ITEMS[id].price, VW - 16, y, { size: 9, align: 'right', col: G.money >= ITEMS[id].price ? C.bone : C.rage }); }
    const cur = SHOP[shopState.cursor]; panel(6, VH - 30, VW - 12, 26); wrapLines(ITEMS[cur].desc, 40).slice(0, 2).forEach((l, i) => text(l, 12, VH - 25 + i * 10, { size: 8, col: C.dim }));
    text('A: buy   B: leave', 12, VH - 6, { size: 7, col: C.dim, shadow: false });
    if (flashT > 0) { flashT -= 16; panel(40, 60, VW - 80, 20); text(Array.isArray(flashMsg) ? flashMsg[0] : flashMsg, VW / 2, 66, { size: 9, align: 'center', col: C.slime }); }
  }
  function renderDex() {
    renderField(); panel(6, 6, VW - 12, VH - 12);
    const seen = Object.keys(G.dexSeen).length, caught = Object.keys(G.dexCaught).length, total = Object.keys(DEX).length;
    text('SLIMÉDEX', 14, 12, { size: 10, col: C.slime });
    text('caught ' + caught + ' / ' + total + '   seen ' + seen, 14, 26, { size: 8, col: C.gold });
    const ids = Object.keys(DEX); let row = 0;
    for (let i = 0; i < ids.length; i++) { const id = ids[i]; const x = 14 + (i % 2) * 112, y = 40 + Math.floor(i / 2) * 11; const got = G.dexCaught[id], sn = G.dexSeen[id]; text((got ? '◉ ' : sn ? '○ ' : '— ') + (sn ? DEX[id].name : '??????'), x, y, { size: 8, col: got ? C.slime : sn ? C.bone : C.dim }); }
    text('B: back', 14, VH - 14, { size: 8, col: C.dim });
  }
  function renderChoice() {
    (B ? renderBattle : renderField)();
    // dialog box with the prompt + options
    const h = 46, y = VH - h; panel(2, y, VW - 4, h - 2);
    text(choiceState.prompt, 10, y + 6, { size: 9 });
    for (let i = 0; i < choiceState.opts.length; i++) text((choiceState.cursor === i ? '▶ ' : '   ') + choiceState.opts[i].label, 24 + i * 70, y + 24, { size: 9, col: choiceState.cursor === i ? C.slime : C.bone });
  }
  function renderDialog() { (B ? renderBattle : renderField)(); msgbox(msgQ[0] || ''); }

  function render() {
    if (!ctx) return;
    try {
      switch (mode) {
        case 'title': renderTitle(); break;
        case 'field': renderField(); break;
        case 'dialog': renderDialog(); break;
        case 'choice': renderChoice(); break;
        case 'menu': renderMenu(); break;
        case 'team': renderTeam(); break;
        case 'bag': renderBag(); break;
        case 'shop': renderShop(); break;
        case 'dex': renderDex(); break;
        case 'battle': renderBattle(); break;
        default: renderField();
      }
      if (fade > 0) { ctx.globalAlpha = fade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
    } catch (_) { /* never let a draw glitch kill the loop */ }
  }

  /* ===================== loop + lifecycle ===================== */
  function tick(dt) {
    anim += dt; blink = (blink + dt) % 100000;
    // transition fade
    if (fade > 0 && fadeTo === 1) { fade += dt / 180; if (fade >= 1) { fade = 1; if (fadeCb) { const cb = fadeCb; fadeCb = null; cb(); } fadeTo = 0; } }
    else if (fadeTo === 0 && fade > 0) { fade -= dt / 180; if (fade < 0) fade = 0; }
    update(dt);
    pressed.length = 0;
  }
  function update(dt) {
    switch (mode) {
      case 'title': titleUpdate(); break;
      case 'field': fieldUpdate(dt); break;
      case 'dialog': for (const a of pressed) if (a === 'a' || a === 'start' || a === 'b') { sayAdvance(); break; } break;
      case 'choice': choiceUpdate(); break;
      case 'menu': menuUpdate(); break;
      case 'team': teamUpdate(); break;
      case 'bag': bagUpdate(); break;
      case 'shop': shopUpdate(); break;
      case 'dex': for (const a of pressed) if (a === 'b' || a === 'start') mode = 'field'; break;
      case 'battle': battleUpdate(dt); break;
    }
  }
  function loop(t) {
    if (!running) return;
    if (!cv || !document.body.contains(cv)) { unmount(); return; }
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(50, t - (lastF || t)); lastF = t;
    tick(dt); render();
  }

  function relayout() {
    if (!cv || !el.cabinet) return;
    let r; try { r = el.cabinet.getBoundingClientRect(); } catch (_) { r = { width: VW * 3, height: VH * 3 }; }
    const dpr = Math.min((typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1) || 1, 2.5);
    const bw = Math.max(VW, Math.round((r.width || VW * 3) * dpr)), bh = Math.max(VH, Math.round((r.height || VH * 3) * dpr));
    if (cv.width !== bw) cv.width = bw; if (cv.height !== bh) cv.height = bh;
    ctx.imageSmoothingEnabled = false;
    const s = Math.max(1, Math.min(bw / VW, bh / VH));
    scale = s; offX = Math.floor((bw - VW * s) / 2); offY = Math.floor((bh - VH * s) / 2);
    try { if (el.deck) document.documentElement.style.setProperty('--pk-deckh', Math.ceil(el.deck.getBoundingClientRect().height) + 'px'); } catch (_) { }
  }
  function scheduleRelayout() { if (relayoutQueued) return; relayoutQueued = true; requestAnimationFrame(() => { relayoutQueued = false; relayout(); }); }

  function mount(r) {
    if (!r) return; root = r;
    cv = q('pkGame'); if (!cv) return;
    ctx = cv.getContext('2d'); cv.width = VW * 3; cv.height = VH * 3; ctx.imageSmoothingEnabled = false;
    el = { cabinet: q('pkCabinet'), deck: q('pkDeck') };
    if (hasTouch) root.classList.add('pk-has-touch');
    if (inputAC) { try { inputAC.abort(); } catch (_) { } }
    if (ro) { try { ro.disconnect(); } catch (_) { } ro = null; }
    bindInputs();
    bindTouch(q('pkU'), () => { setHeld('up', true); pushEdge('up'); }, () => setHeld('up', false));
    bindTouch(q('pkD'), () => { setHeld('down', true); pushEdge('down'); }, () => setHeld('down', false));
    bindTouch(q('pkL'), () => { setHeld('left', true); pushEdge('left'); }, () => setHeld('left', false));
    bindTouch(q('pkR'), () => { setHeld('right', true); pushEdge('right'); }, () => setHeld('right', false));
    bindTouch(q('pkA'), () => pushEdge('a'));
    bindTouch(q('pkB'), () => pushEdge('b'));
    bindTouch(q('pkStart'), () => pushEdge('start'));
    bindTouch(q('pkSelect'), () => pushEdge('select'));
    if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(scheduleRelayout); ro.observe(el.cabinet); if (el.deck) ro.observe(el.deck); }
    addEventListener('resize', scheduleRelayout, { signal: inputAC.signal });
    addEventListener('orientationchange', scheduleRelayout, { signal: inputAC.signal });
    relayout();
    // (re)enter at the title screen; a save offers CONTINUE
    mode = 'title'; titleCursor = 0; B = null; held = {}; pressed = []; fade = 0;
    if (!running) { running = true; lastF = 0; rafId = requestAnimationFrame(loop); }
    window.SBPoke._mounted = true;
  }
  function unmount() {
    running = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0;
    if (ro) { try { ro.disconnect(); } catch (_) { } ro = null; }
    try { document.documentElement.style.removeProperty('--pk-deckh'); } catch (_) { }
    if (inputAC) { try { inputAC.abort(); } catch (_) { } inputAC = null; }
    held = {}; pressed = []; downKeys = {};
    window.SBPoke._mounted = false;
  }

  /* ===================== public API + sim hooks ===================== */
  function stepOnce(dt) { tick(dt || 16.7); render(); }
  window.SBPoke = {
    mount, unmount, _mounted: false,
    /* read-mostly introspection for the headless sim (tests/poke.sim.mjs): live refs +
       a few drivers so it can run the REAL engine with no browser and prove it's winnable. */
    _debug() {
      return {
        get mode() { return mode; }, set mode(m) { mode = m; },
        get G() { return G; }, get B() { return B; },
        DEX, MOVES, TYPES, MAPS, ITEMS,
        eff, effMulti, calcDamage, tryCatch, makeMon, statAt, effStat, gainExp,
        srand, rng,
        newGame, continueGame, saveGame, hasSave, healParty, del: () => del(SAVE_KEY),
        press: a => pushEdge(a), hold: (a, on) => setHeld(a, on), step: dt => stepOnce(dt),
        warpTo(map, x, y) { G.map = map; G.px = x; G.py = y; G.dir = 'd'; walkT = 0; mode = 'field'; snapCam(); },
        giveMon(spId, lv) { const m = makeMon(spId, lv); addMon(m); catchDex(spId); return m; },
        startWild(spId, lv) { beginWild(makeMon(spId, lv)); },
        startTrainer(n) { startTrainerBattle(n); },
        npc(map, i) { return MAPS[map].npcs[i]; },
        msgs() { return B ? B.mq.slice() : msgQ.slice(); },
        battlePhase() { return B ? B.phase : null; },
        /* advance any pending message/dialogue queue to completion */
        flush(max) { let g = max || 400; while (g-- > 0) { if (mode === 'battle' && B && (B.phase === 'msg' || B.phase === 'intro')) { pushEdge('a'); stepOnce(); } else if (mode === 'dialog') { pushEdge('a'); stepOnce(); } else break; } },
      };
    },
  };
})();

