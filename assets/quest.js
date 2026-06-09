/* ============================================================================
   SLIME, THEY NEED YOU!  —  "Slime the Game"
   ----------------------------------------------------------------------------
   A beat-reactive arcade platformer for the SLIME BY site. This is a MOUNTABLE
   module (not a standalone page) so it co-operates with the site's client-side
   router: app.js calls SBQuest.mount(root) when quest.html's <main> is on
   screen and the loop auto-stops (SBQuest.unmount) the moment its canvas leaves
   the DOM, so navigating away never leaves a stray rAF / key listeners behind.

   AUDIO: the game has NO synth of its own — it rides the site's real player.
   Through window.SBPlayer it taps the same AnalyserNode the site visualizer
   uses, so the beat visuals, BEAT JUMP window, boss-crown timing and the HUD
   spectrum all react to whatever Slime By track is actually spinning. Pressing
   START also starts the site music so the catalog becomes the soundtrack.
   ============================================================================ */
(function () {
  "use strict";
  if (window.SBQuest) return; // defined once; app.js re-mounts the same module

  /* ===================== palette (aligned to the SB site) ===================== */
  const C = {
    slime: '#8dff2b', slimeBright: '#c2ff7a', slimeDeep: '#2a7a00', slimeDark: '#0c2e10',
    toxic: '#d6ff38', gold: '#ffd166', goldLt: '#fff0b0',
    rage: '#ff1f2e', rageSoft: '#ff5a45', rageDeep: '#6e0411',
    purple: '#9b3cff', purpleSoft: '#c47bff',
    sbBlue: '#2348d8', sbBlueLite: '#3a6bff', sbBlueDk: '#16205c',
    ink: '#06120a', bone: '#eafbe4',
    skin: '#a4683b', skinSh: '#7c4a28', skinLt: '#c4824f', hair: '#181009', beard: '#0d0905',
  };

  /* ===================== render target ===================== */
  const W = 512, H = 288;            // internal 16:9 render width + base height (level tuned to this)
  let cv = null, ctx = null;
  /* Responsive view: W stays fixed (horizontal gameplay unchanged) but the canvas BUFFER
     height (VH) tracks the cabinet's real aspect, so a tall mobile viewport shows MORE
     vertical world instead of stretching or leaving a black void. VOFF pushes the world
     down so the ground line sits ~64% of the way down; WB (= VH - VOFF) is the world-space
     bottom that ground + pits fill to. On a 16:9 cabinet VH=H, VOFF=0 → identical to before. */
  let VH = H, VOFF = 0, WB = H, ro = null, relayoutQueued = false;

  /* honour the OS "reduce motion" setting: tame screen-shake + thin out particles */
  const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } })();
  const canVibe = (() => { try { return typeof navigator.vibrate === 'function'; } catch (_) { return false; } })();
  function vibe(ms) { if (canVibe) try { navigator.vibrate(ms); } catch (_) { } }
  // dock the site music bar into a compact, out-of-the-way mode while a run is live
  function setPlayingChrome(on) { try { document.body.classList.toggle('q-playing', !!on); } catch (_) { } }

  /* ===================== world / level (tuning preserved) ===================== */
  const LW = 3400, GY = 232;
  const plats = [
    { x: 0, y: GY, w: 600 }, { x: 690, y: GY, w: 430 }, { x: 1210, y: GY, w: 540 }, { x: 1830, y: GY, w: 1570 },
    { x: 330, y: 176, w: 96 }, { x: 760, y: 160, w: 92 }, { x: 960, y: 128, w: 84 },
    { x: 1320, y: 168, w: 92 }, { x: 1520, y: 128, w: 84 },
    { x: 2010, y: 162, w: 100 }, { x: 2270, y: 128, w: 92 }, { x: 2560, y: 170, w: 96 },
  ];
  const pits = [[600, 90], [1120, 90], [1750, 80]];

  /* ===================== state ===================== */
  let state = 'title';
  let player, cam, enemies, coins, particles, blasts, notes, boss, theKey, princess, torches, fireflies, decals, floaters;
  let hp, maxHp = 4, score, keysGot, rage, rageOn, rageT, shake, flash, win, timeNow = 0, hitStop = 0;
  let dlgQ = [], dlgT = 0, kills = 0, bossUp = false, keyUp = false, combo = 0, comboT = 0, bestCombo = 0;
  let beatFlash = 0;

  /* ===================== AUDIO BRIDGE → site player ===================== */
  /* Reads the site's live AnalyserNode (window.SBPlayer) and derives an energy
     based beat. No knowledge of BPM required — it locks to the kick of whatever
     track the site is playing. When the player is silent it falls back to a
     gentle internal clock so BEAT JUMP still feels rhythmic. */
  const QA = (() => {
    const NB = 64;                    // analyser.frequencyBinCount (fftSize 128)
    const data = new Uint8Array(NB);
    let bass = 0, bassAvg = 0, mid = 0, level = 0;
    let lastBeat = -1, beatPulse = 0, clock = 0;
    const FALLBACK_BPM = 112;
    function P() { return window.SBPlayer || null; }
    function playing() { try { return !!(P() && P().isPlaying()); } catch (_) { return false; } }
    function start() { try { P() && P().start(); } catch (_) { } }
    function ensure() { try { P() && P().ensureCtx(); } catch (_) { } }
    function sample(dt) {
      const sp = P(), an = sp && sp.analyser && sp.analyser();
      const live = !!(an && playing());
      if (live) {
        try { an.getByteFrequencyData(data); } catch (_) { }
        let b = 0, m = 0, t = 0;
        for (let i = 1; i <= 3; i++) b += data[i]; b /= 3 * 255;
        for (let i = 8; i <= 22; i++) m += data[i]; m /= 15 * 255;
        for (let i = 0; i < NB; i++) t += data[i]; t /= NB * 255;
        bass += (b - bass) * 0.5; mid += (m - mid) * 0.4; level += (t - level) * 0.4;
        bassAvg += (bass - bassAvg) * 0.045;
        // transient over the moving average → a kick
        if (bass > bassAvg * 1.32 + 0.06 && (timeNow - lastBeat) > 175 && bass > 0.12) {
          lastBeat = timeNow; beatPulse = 1; beatFlash = Math.min(1, beatFlash + 0.5);
        }
      } else {
        // silent fallback clock
        clock += dt;
        const period = 60000 / FALLBACK_BPM;
        if (clock >= period) { clock -= period; lastBeat = timeNow; beatPulse = 1; beatFlash = Math.min(1, beatFlash + 0.5); }
        level += ((0.16 + 0.1 * Math.sin(timeNow * 0.004)) - level) * 0.05;
        bass += (0.12 + 0.1 * Math.max(0, Math.sin(timeNow * 0.006)) - bass) * 0.1;
      }
      beatPulse *= 0.9;
    }
    return {
      sample, start, ensure, playing,
      beatStrength() { return Math.max(beatPulse, bass * 0.9, level * 0.6); },
      onBeat() { return (timeNow - lastBeat) < 135; },
      level() { return level; },
      bass() { return bass; },
      band(i, n) { const idx = 1 + Math.floor(i / n * 40); return (data[idx] || 0) / 255; },
      live() { return playing(); },
    };
  })();

  /* ===================== input ===================== */
  const K = { l: false, r: false, jump: false, jumpEdge: false, atk: false, atkEdge: false, dash: false, dashEdge: false, rage: false, rageEdge: false };
  let held = {};
  let inputAC = null;          // AbortController for all listeners (cleared on unmount)
  let typed = '';

  function onKey(e, down) {
    const c = e.code; let game = true;
    switch (c) {
      case 'ArrowLeft': case 'KeyA': K.l = down; break;
      case 'ArrowRight': case 'KeyD': K.r = down; break;
      case 'ArrowUp': case 'KeyW': case 'Space': if (down) { K.jump = true; K.jumpEdge = true; } else K.jump = false; break;
      case 'KeyJ': if (down) { K.atk = true; K.atkEdge = true; } else K.atk = false; break;
      case 'KeyK': if (down) { K.dash = true; K.dashEdge = true; } else K.dash = false; break;
      case 'KeyR': if (down) { K.rage = true; K.rageEdge = true; } else K.rage = false; break;
      case 'KeyP': if (down) togglePause(); break;
      case 'Enter': case 'NumpadEnter': if (down && state !== 'play' && state !== 'paused') startGame(); game = false; break;
      default: game = false;
    }
    if (game) { e.preventDefault(); e.stopPropagation(); } // keep the site's space=pause etc. out of the cabinet
  }
  function bindInputs() {
    inputAC = new AbortController(); const sig = inputAC.signal;
    addEventListener('keydown', e => {
      if (held[e.code]) { // repeat: still swallow game keys, don't refire edges
        onKeySwallow(e); return;
      }
      held[e.code] = true; onKey(e, true);
      if (e.key && e.key.length === 1) { typed = (typed + e.key.toLowerCase()).slice(-12); if ((typed.endsWith('princess') || typed.endsWith('slime')) && state === 'title') startGame(); }
    }, { capture: true, signal: sig });
    addEventListener('keyup', e => { held[e.code] = false; onKey(e, false); }, { capture: true, signal: sig });
    addEventListener('blur', () => { for (const k in K) if (typeof K[k] === 'boolean') K[k] = false; held = {}; }, { signal: sig });
    // auto-pause a live run when the tab is hidden (rAF already halts; this stops deaths-while-away)
    document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); }, { signal: sig });
  }
  function onKeySwallow(e) {
    const c = e.code;
    if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'ArrowUp' || c === 'ArrowDown' || c === 'Space' ||
      c === 'KeyA' || c === 'KeyD' || c === 'KeyW' || c === 'KeyJ' || c === 'KeyK' || c === 'KeyR') { e.preventDefault(); e.stopPropagation(); }
  }
  /* Pointer-event based control button. One unified path covers touch, pen and
     mouse, and because each deck button is its own element multi-touch "just works"
     (two thumbs = two independent pointerdowns). A .pressed class drives the glow /
     pulse feedback and a short haptic tick fires on press where supported. */
  function bindTouch(el, dn, up) {
    if (!el) return; const sig = inputAC.signal;
    let active = false;
    const press = e => { if (active) return; active = true; el.classList.add('pressed'); try { e.preventDefault(); } catch (_) { } vibe(8); dn(); };
    const release = e => { if (!active) return; active = false; el.classList.remove('pressed'); try { e && e.preventDefault(); } catch (_) { } up && up(); };
    el.addEventListener('pointerdown', press, { signal: sig });
    el.addEventListener('pointerup', release, { signal: sig });
    el.addEventListener('pointercancel', release, { signal: sig });
    el.addEventListener('pointerleave', release, { signal: sig });   // finger slid off a held button → don't stick
    el.addEventListener('contextmenu', e => e.preventDefault(), { signal: sig }); // kill the long-press menu
  }

  /* ===================== element refs (re-queried each mount) ===================== */
  let el = {};
  function q(id) { return root ? root.querySelector('#' + id) : null; }
  let root = null;

  /* ===================== reset / spawn ===================== */
  function reset() {
    player = {
      x: 70, y: GY - 44, w: 22, h: 44, vx: 0, vy: 0, onGround: false, dir: 1,
      dashCD: 0, dashT: 0, atkCD: 0, atkT: 0, inv: 0, bob: 0, walk: 0, squash: 1, land: 0, coyote: 0, jumpBuf: 0,
      blink: 0, trail: [], aura: 0,
    };
    cam = { x: 0 };
    enemies = []; coins = []; particles = []; blasts = []; notes = []; torches = []; fireflies = []; decals = []; floaters = [];
    boss = null; theKey = null;
    hp = maxHp; score = 0; keysGot = 0; rage = 0; rageOn = false; rageT = 0; shake = 0; flash = 0; win = false;
    kills = 0; bossUp = false; keyUp = false; combo = 0; comboT = 0; bestCombo = 0; dlgQ = []; dlgT = 0; hitStop = 0;
    princess = { x: 3240, y: 96, t: 0 };
    [180, 520, 1000, 1500, 2050, 2600, 3050].forEach(x => torches.push({ x, y: GY - 2, t: Math.random() * 6 }));
    for (let i = 0; i < 52; i++) fireflies.push({ x: Math.random() * LW, y: 36 + Math.random() * 170, t: Math.random() * 6, sp: 0.2 + Math.random() * 0.5, r: 1 + Math.random() * 1.6 });
    for (let i = 0; i < 44; i++) { const x = Math.random() * LW; if (pits.some(p => x > p[0] - 20 && x < p[0] + p[1] + 20)) continue; decals.push({ x, y: GY, type: Math.random() < .42 ? 'mush' : 'rock', f: Math.random() * 6, s: 0.8 + Math.random() * 0.6 }); }
    // enemies (mites/bats/serpents) + the new beat-synced amps
    spawn('mite', 440, GY); spawn('mite', 840, GY); spawn('bat', 1000, 96);
    spawn('amp', 1180, GY); spawn('serpent', 1340, GY); spawn('bat', 1560, 86); spawn('mite', 1900, GY);
    spawn('serpent', 2120, GY); spawn('bat', 2300, 100); spawn('amp', 2420, GY); spawn('mite', 2500, GY); spawn('serpent', 2700, GY);
    const spots = [[220, 186], [345, 150], [380, 150], [760, 190], [800, 134], [980, 100], [1080, 190],
    [1340, 142], [1380, 142], [1540, 100], [1680, 190], [2030, 136], [2290, 100], [2440, 190],
    [2580, 144], [2760, 170], [2900, 190], [3050, 160]];
    spots.forEach((s, i) => coins.push({ x: s[0], y: s[1], got: false, shard: i % 6 === 0, bob: Math.random() * 6 }));
    queue('elder', 'VILLAGE ELDER', 'The 808 Emerald has gone silent...');
    queue('slime', 'SLIME BY', 'Who took it?');
    queue('elder', 'VILLAGE ELDER', 'The Red Serpent King. He locked Vena in Static Castle.');
    queue('vena', 'PRINCESS VENA', 'Slime... they need you.');
    queue('quest', 'HOW TO FIGHT', 'JUMP on beasts to STOMP them — or fire the MIC BLAST.');
    queue('quest', 'QUEST', 'DEFEAT 5 BEASTS · FIND THE SLIME KEY · DETHRONE THE KING');
  }
  function spawn(type, x, y) {
    const e = { x, y, type, dead: false, fade: 0, t: Math.random() * 6, hp: 1, kb: 0 };
    if (type === 'mite') { e.w = 18; e.h = 14; e.vx = (Math.random() < .5 ? -1 : 1) * 0.6; e.rng = [x - 60, x + 60]; e.hop = 0; }
    if (type === 'bat') { e.w = 20; e.h = 12; e.bx = x; e.by = y; e.vx = 0.9; e.flap = Math.random() * 6; }
    if (type === 'serpent') { e.w = 26; e.h = 14; e.hp = 2; e.vx = (Math.random() < .5 ? -1 : 1) * 0.8; e.rng = [x - 80, x + 80]; }
    if (type === 'amp') { e.w = 24; e.h = 22; e.hp = 3; e.y = GY - 22; e.fireCD = 60 + Math.random() * 40; e.glow = 0; e.cone = 0; }
    enemies.push(e);
  }
  function queue(c, who, txt) { dlgQ.push({ c, who, txt }); }
  function pumpDlg() {
    if (dlgT > 0 || !dlgQ.length || !el.dlg) return; const d = dlgQ.shift();
    el.dlgwho.className = 'q-who ' + d.c; el.dlgwho.textContent = d.who;
    el.dlgtxt.textContent = d.txt; el.dlg.classList.add('show'); dlgT = 140 + d.txt.length * 1.1;
  }

  /* ===================== helpers ===================== */
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function burst(x, y, col, n, spd, opt) {
    opt = opt || {};
    if (REDUCED) n = Math.ceil(n * 0.5);   // lighter particle load when motion is reduced
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = Math.random() * spd + 0.4;
      particles.push({
        x, y, vx: Math.cos(a) * s + (opt.vx || 0), vy: Math.sin(a) * s - 1 + (opt.vy || 0),
        life: (opt.life || 26) + Math.random() * 14, max: (opt.life || 26) + 14, col,
        size: (opt.size || 2) + Math.random() * 2, grav: opt.grav == null ? 0.16 : opt.grav, glow: opt.glow, shape: opt.shape || 'sq',
      });
    }
  }
  function ring(x, y, col, life) { particles.push({ x, y, vx: 0, vy: 0, life, max: life, col, size: 2, grav: 0, glow: 1, shape: 'ring', r: 2 }); }
  function floatText(x, y, txt, col) { floaters.push({ x, y, txt, col, life: 50, max: 50 }); }
  function showCombo() {
    if (combo < 2 || !el.combo) return;
    el.combo.textContent = 'x' + combo + (combo >= 6 ? ' SLIME STREAK!' : combo >= 4 ? ' ON BEAT!' : ' COMBO'); el.combo.classList.add('show'); comboT = 70;
  }

  /* ===================== UPDATE ===================== */
  function update(dt) {
    timeNow = performance.now();
    QA.sample(dt);
    if (state !== 'play') return;
    if (hitStop > 0) { hitStop--; return; }     // micro freeze on big hits = punch
    const p = player, bs = QA.beatStrength();

    if (rageOn) { rageT--; if (rageT <= 0) rageOn = false; }
    if (K.rageEdge && rage >= 100 && !rageOn) {
      rageOn = true; rageT = 440; rage = 0; shake = 12; flash = 9;
      burst(p.x + p.w / 2, p.y + p.h / 2, C.rage, 36, 4.6, { glow: 1 }); ring(p.x + p.w / 2, p.y + p.h / 2, C.rage, 26);
      queue('slime', 'SLIME BY', 'RAGE MODE!!');
    }
    K.rageEdge = false;

    const spd = rageOn ? 3.5 : 2.7;
    if (K.l) { p.vx = -spd; p.dir = -1; } else if (K.r) { p.vx = spd; p.dir = 1; } else p.vx *= 0.72;

    // dash
    if (p.dashCD > 0) p.dashCD--;
    if (K.dashEdge && p.dashCD <= 0 && p.dashT <= 0) { p.dashT = 11; p.dashCD = 46; p.squash = 1.4; burst(p.x + p.w / 2, p.y + p.h - 4, C.slime, 10, 2.5, { glow: 1, shape: 'goo' }); }
    K.dashEdge = false;
    if (p.dashT > 0) { p.dashT--; p.vx = p.dir * (rageOn ? 6.6 : 5.6); if (p.dashT % 2 === 0) p.trail.push({ x: p.x, y: p.y, dir: p.dir, life: 10 }); }

    // jump w/ coyote + buffer + BEAT JUMP (real-music timed)
    // forgiving windows (coyote/buffer 9f) + a strong base arc so every gap in the
    // level is comfortably clearable — the pits are 80-90px wide, this jump carries
    // ~110px, with the beat jump reaching further still.
    if (p.onGround) p.coyote = 9; else if (p.coyote > 0) p.coyote--;
    if (K.jumpEdge) p.jumpBuf = 9; else if (p.jumpBuf > 0) p.jumpBuf--;
    K.jumpEdge = false;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      const boost = QA.onBeat() ? 1.2 : 1; p.vy = -7.4 * boost;
      p.onGround = false; p.coyote = 0; p.jumpBuf = 0; p.squash = 0.7;
      if (boost > 1) { burst(p.x + p.w / 2, p.y + p.h, C.toxic, 16, 3, { glow: 1, shape: 'goo' }); ring(p.x + p.w / 2, p.y + p.h, C.toxic, 16); flash = 2; floatText(p.x + p.w / 2, p.y - 6, 'BEAT JUMP', C.toxic); }
      else burst(p.x + p.w / 2, p.y + p.h, C.slimeDeep, 6, 1.5, { shape: 'goo' });
    }
    if (!K.jump && p.vy < -2) p.vy *= 0.86;
    p.vy += 0.35; if (p.vy > 10.5) p.vy = 10.5;

    // mic blast
    if (p.atkCD > 0) p.atkCD--;
    if (K.atkEdge && p.atkCD <= 0) {
      p.atkCD = 20; p.atkT = 10; p.squash = 1.18;
      blasts.push({ x: p.x + (p.dir > 0 ? p.w - 4 : -26), y: p.y + 12, w: 30, h: 20, dir: p.dir, life: 15, big: rageOn, grew: 0 });
      burst(p.x + (p.dir > 0 ? p.w : 0), p.y + 16, C.slime, 7, 2, { glow: 1 });
    }
    K.atkEdge = false;
    if (p.atkT > 0) p.atkT--;

    // integrate + collide
    p.x += p.vx; p.y += p.vy; p.onGround = false;
    for (const pl of plats) {
      if (p.x + p.w > pl.x && p.x < pl.x + pl.w) {
        if (p.vy >= 0 && p.y + p.h > pl.y && p.y + p.h < pl.y + 26) { if (!p.onGround && p.vy > 3) { p.land = 6; p.squash = 1.3; burst(p.x + p.w / 2, pl.y, C.slimeDeep, 5, 1.5, { shape: 'goo', life: 14 }); } p.y = pl.y - p.h; p.vy = 0; p.onGround = true; }
      }
    }
    if (p.x < 0) p.x = 0; if (p.x + p.w > LW) p.x = LW - p.w;
    if (p.y > WB + 60) { damage(1, true); p.x = Math.max(40, p.x - 70); p.y = GY - 44; p.vy = 0; }

    if (p.inv > 0) p.inv--;
    p.bob += 0.16; if (Math.abs(p.vx) > 0.6) p.walk += Math.abs(p.vx) * 0.06; else p.walk *= 0.8;
    p.squash += (1 - p.squash) * 0.2; if (p.land > 0) p.land--;
    p.aura += ((rageOn ? 1 : 0.55 + bs * 0.6) - p.aura) * 0.1;
    if (p.blink > 0) p.blink--; else if (Math.random() < 0.006) p.blink = 7;
    // slime footprints
    if (p.onGround && Math.abs(p.vx) > 1.4 && Math.floor(timeNow / 90) % 2 === 0 && Math.random() < 0.4)
      particles.push({ x: p.x + p.w / 2, y: p.y + p.h - 1, vx: 0, vy: 0, life: 40, max: 40, col: rageOn ? C.rageSoft : C.slimeDeep, size: 3, grav: 0, glow: 0, shape: 'puddle' });
    for (const tr of p.trail) tr.life--; p.trail = p.trail.filter(t => t.life > 0);

    // camera w/ lookahead + beat sway
    const look = p.dir * 40;
    cam.x += ((p.x - W / 2 + look) - cam.x) * 0.1; cam.x = Math.max(0, Math.min(LW - W, cam.x));

    // blasts
    for (const b of blasts) {
      b.x += b.dir * (b.big ? 7.5 : 6.2); b.life--; b.grew = Math.min(1, b.grew + 0.2);
      if (b.big) { b.w = 40; b.h = 26; }
      if (Math.random() < .7) burst(b.x + b.w / 2, b.y + b.h / 2, b.big ? C.toxic : C.slimeBright, 1, 1, { grav: 0, life: 10, glow: 1 });
    }
    blasts = blasts.filter(b => b.life > 0);

    // enemies
    for (const e of enemies) {
      if (e.dead) { e.fade -= 0.1; continue; }
      e.t += 0.09; if (e.kb) { e.x += e.kb; e.kb *= 0.8; if (Math.abs(e.kb) < 0.1) e.kb = 0; }
      if (e.type === 'mite') {
        e.x += e.vx * (rageOn ? 1.5 : 1); if (e.x < e.rng[0] || e.x > e.rng[1]) e.vx *= -1;
        e.hop = Math.abs(Math.sin(e.t * 3)); e.y = GY - e.h - e.hop * 5;
      }
      if (e.type === 'bat') { e.flap += 0.4; e.bx += e.vx * (rageOn ? 1.6 : 1); if (e.bx > e.x + 100 || e.bx < e.x - 100) e.vx *= -1; e.cy = e.by + Math.sin(e.t * 1.6) * 26; e.dx = e.bx; e.dy = e.cy; }
      if (e.type === 'serpent') {
        const d = Math.abs(p.x - e.x);
        if (d < 90) e.x += (p.x > e.x ? 1 : -1) * (rageOn ? 2 : 1.4);
        else { e.x += e.vx * (rageOn ? 1.5 : 1); if (e.x < e.rng[0] || e.x > e.rng[1]) e.vx *= -1; }
        e.y = GY - e.h;
      }
      if (e.type === 'amp') {
        e.y = GY - e.h; e.glow *= 0.86; e.cone *= 0.9;
        const near = Math.abs(p.x - (e.x + e.w / 2)) < 230 && Math.abs(p.x - e.x) > 24;
        if (QA.onBeat()) e.glow = Math.min(1, e.glow + 0.6);
        e.fireCD--;
        if (e.fireCD <= 0 && near && QA.onBeat()) {
          const dir = p.x > e.x ? 1 : -1; e.fireCD = 46; e.cone = 1; shake = Math.max(shake, 3);
          notes.push({ x: e.x + e.w / 2 + dir * 12, y: e.y + 6, vx: dir * 2.4, vy: -0.4, kind: 'shock', t: 0 });
          burst(e.x + e.w / 2 + dir * 10, e.y + 6, C.rageSoft, 6, 2, { glow: 1 });
        } else if (e.fireCD <= 0) e.fireCD = 24;
      }
      const ex = e.type === 'bat' ? e.dx : e.x, ey = e.type === 'bat' ? e.dy : e.y;
      const eb = { x: ex, y: ey, w: e.w, h: e.h }; e._x = ex; e._y = ey;
      for (const b of blasts) {
        if (hit(b, eb)) {
          e.hp--; e.kb = b.dir * 5; burst(ex + e.w / 2, ey, C.toxic, 9, 2.5, { glow: 1 });
          b.life = Math.min(b.life, 4); if (e.hp <= 0) kill(e, ex, ey);
        }
      }
      if (p.inv <= 0 && hit(p, eb)) {
        // STOMP — coming down onto an enemy from above defeats it (Mario-style) and
        // bounces you off. This is the intuitive "jump on it" kill players expect, so
        // enemies never feel unkillable even before they discover the mic blast.
        const feetWasAbove = (p.y + p.h - p.vy) <= ey + 7;
        const stomping = p.vy > 0.6 && feetWasAbove;
        if (p.dashT > 0) { kill(e, ex, ey); }
        else if (stomping) {
          e.hp--; p.vy = K.jump ? -8 : -6; p.jumpBuf = 0; p.coyote = 0; p.squash = 1.35; p.inv = Math.max(p.inv, 6);
          shake = Math.max(shake, 3); hitStop = Math.max(hitStop, 1);
          burst(ex + e.w / 2, ey, C.toxic, 9, 2.4, { glow: 1, shape: 'goo' });
          if (e.hp <= 0) kill(e, ex, ey);
          else { e.kb = (p.x < ex ? 1 : -1) * 3; floatText(ex + e.w / 2, ey - 6, 'STOMP!', C.toxic); }
        }
        else damage(1);
      }
    }
    enemies = enemies.filter(e => !e.dead || e.fade > 0);

    // coins / shards
    for (const c of coins) {
      if (c.got) continue; c.bob += 0.1;
      if (hit(p, { x: c.x - 9, y: c.y - 9, w: 18, h: 18 })) {
        c.got = true; score += c.shard ? 5 : 1;
        if (c.shard && hp < maxHp) hp++; rage = Math.min(100, rage + (c.shard ? 9 : 3));
        burst(c.x, c.y, c.shard ? C.gold : C.slime, c.shard ? 14 : 8, 2.5, { glow: 1 });
        if (c.shard) floatText(c.x, c.y - 8, '+5', C.gold);
      }
    }

    // slime key
    if (!keyUp && kills >= 5) { keyUp = true; theKey = { x: 1680, y: 184, t: 0 }; notes.push({ x: 1680, y: 130, t: 0, kind: 'guide' }); queue('vena', 'PRINCESS VENA', 'A Slime Key surfaced. Grab it to open the gate.'); }
    if (theKey) {
      theKey.t += 0.09;
      if (hit(p, { x: theKey.x - 12, y: theKey.y - 12, w: 24, h: 24 })) {
        theKey = null; keysGot = 1; shake = 7; vibe([12, 30, 12]);
        notes = notes.filter(n => n.kind !== 'guide');   // the key marker is done — don't leave it floating forever
        burst(p.x, p.y + 10, C.slime, 20, 3.5, { glow: 1 }); ring(p.x + p.w / 2, p.y + 10, C.slime, 22);
        floatText(p.x + p.w / 2, p.y - 8, 'SLIME KEY!', C.slime);
        if (el.keys && el.keys.parentElement) { const k = el.keys.parentElement; k.classList.add('got'); setTimeout(() => k.classList.remove('got'), 520); }
        queue('vena', 'PRINCESS VENA', 'The gate yields. The bass is returning!');
      }
    }

    // boss
    if (!bossUp && keysGot >= 1 && p.x > 2650) {
      bossUp = true;
      boss = { x: p.x + 260, y: GY - 64, w: 70, h: 64, hp: 12, maxHp: 12, phase: 1, t: 0, atkCD: 110, lunge: 0, vx: 0, hurt: 0, sx: 0, rear: 0 };
      queue('king', 'RED SERPENT KING', 'You DARE enter Static Castle?!');
      queue('vena', 'PRINCESS VENA', 'Strike his crown — TIME it with the beat!');
    }
    if (boss) updateBoss();

    for (const n of notes) {
      if (n.kind === 'guide') n.t += 0.05;
      if (n.kind === 'shock') { n.x += n.vx; n.vy += 0.04; n.y += n.vy; n.t += 0.2; for (const b of blasts) if (hit(b, { x: n.x - 6, y: n.y - 6, w: 12, h: 12 })) { n.hit = true; burst(n.x, n.y, C.toxic, 6, 2, { glow: 1 }); } if (p.inv <= 0 && hit(p, { x: n.x - 6, y: n.y - 6, w: 12, h: 12 })) { damage(1); n.hit = true; } }
    }
    notes = notes.filter(n => !(n.kind === 'shock' && (n.hit || n.x < cam.x - 30 || n.x > cam.x + W + 30 || n.y > WB + 20)) && !(n.kind === 'red' && (n.y > WB + 20 || n.hit)));

    // particles / floaters
    for (const pt of particles) { pt.x += pt.vx; pt.y += pt.vy; pt.vy += pt.grav; pt.life--; if (pt.shape === 'ring') pt.r += 1.6; }
    particles = particles.filter(pt => pt.life > 0);
    for (const f of floaters) { f.y -= 0.5; f.life--; }
    floaters = floaters.filter(f => f.life > 0);
    for (const f of fireflies) { f.t += 0.03; f.x -= f.sp * 0.2; if (f.x < -10) f.x = LW + 10; }

    if (combo > 0) { comboT--; if (comboT <= 0) { if (combo > bestCombo) bestCombo = combo; combo = 0; el.combo && el.combo.classList.remove('show'); } }
    if (shake > 0) shake *= 0.86; if (flash > 0) flash--; if (beatFlash > 0) beatFlash *= 0.85;
    if (dlgT > 0) { dlgT--; if (dlgT <= 0) el.dlg && el.dlg.classList.remove('show'); }
    pumpDlg();
    updateHUD(bs);
  }

  function updateBoss() {
    const p = player, b = boss; b.t += 0.05; if (b.hurt > 0) b.hurt--; if (b.rear > 0) b.rear--;
    b.phase = b.hp > 8 ? 1 : b.hp > 4 ? 2 : 3;
    if (b.lunge > 0) { b.lunge--; b.x += b.vx; }
    else {
      const tgt = p.x + (p.x < b.x ? 150 : -150); b.x += (tgt - b.x) * 0.022; b.atkCD--;
      if (b.atkCD <= 0) {
        if (b.phase === 1 || b.phase === 3) { b.vx = (p.x < b.x ? -1 : 1) * (b.phase === 3 ? 5.5 : 3.8); b.lunge = 28; b.atkCD = b.phase === 3 ? 78 : 120; b.sx = 8; b.rear = 16; }
        else { for (let i = 0; i < 6; i++) notes.push({ x: cam.x + 30 + Math.random() * (W - 60), y: -VOFF - 12, vy: 1.7 + Math.random() * 1.5, kind: 'red', t: 0 }); b.atkCD = 108; b.rear = 14; }
      }
    }
    b.y = GY - b.h; if (b.sx > 0) b.sx *= 0.85;
    if (b.x < 2660) b.x = 2660; if (b.x > LW - b.w) b.x = LW - b.w;
    const bb = { x: b.x, y: b.y, w: b.w, h: b.h }, crown = { x: b.x + 16, y: b.y - 6, w: 40, h: 18 };
    for (const bl of blasts) {
      if (hit(bl, crown)) {
        const onb = QA.onBeat(); const dmg = (rageOn ? 2 : 1) * (onb ? 2 : 1); b.hp -= dmg; b.hurt = 14; shake = onb ? 10 : 6; hitStop = onb ? 3 : 0;
        burst(b.x + b.w / 2, b.y - 4, onb ? C.gold : C.toxic, onb ? 18 : 10, 3.6, { glow: 1 }); if (onb) ring(b.x + b.w / 2, b.y - 4, C.gold, 20);
        floatText(b.x + b.w / 2, b.y - 16, onb ? 'ON BEAT! ' + dmg : '-' + dmg, onb ? C.gold : C.toxic);
        if (onb) { combo++; comboT = 70; showCombo(); }
        bl.life = Math.min(bl.life, 2);
      }
    }
    if (p.inv <= 0 && hit(p, bb)) damage(1);
    for (const n of notes) { if (n.kind !== 'red') continue; n.y += n.vy; if (p.inv <= 0 && hit(p, { x: n.x - 7, y: n.y - 7, w: 14, h: 14 })) { damage(1); n.hit = true; } }
    if (b.hp <= 0) winGame();
  }
  function kill(e, x, y) {
    e.dead = true; e.fade = 1; kills++; score += 2; rage = Math.min(100, rage + 12);
    combo++; comboT = 70; showCombo();
    burst(x + e.w / 2, y + e.h / 2, C.slime, 16, 3.6, { glow: 1, shape: 'goo' });
    burst(x + e.w / 2, y + e.h / 2, C.slimeBright, 8, 2, { glow: 1, life: 18 });
    ring(x + e.w / 2, y + e.h / 2, C.slime, 14);
  }
  function damage(n) {
    const p = player; if (p.inv > 0) return; hp -= n; p.inv = 72; shake = 9; flash = 4; hitStop = 2;
    if (combo > bestCombo) bestCombo = combo;   // bank the peak before the hit wipes the active combo
    combo = 0; comboT = 0; el.combo && el.combo.classList.remove('show');
    burst(p.x + p.w / 2, p.y + p.h / 2, C.rage, 14, 3.5, { glow: 1 }); p.vy = -3.4; p.vx = -p.dir * 3.5;
    if (hp <= 0) gameOver();
  }

  /* ===================== RENDER ===================== */
  function rr(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, Math.ceil(w), Math.ceil(h)); }
  function draw() {
    const sh = REDUCED ? 0 : (shake || 0);
    const sx = (Math.random() - .5) * sh, sy = (Math.random() - .5) * sh;
    ctx.save(); ctx.translate(sx, sy);
    const bs = QA.beatStrength(), cx = Math.floor(cam.x);

    drawSky(bs);
    ctx.save(); ctx.translate(0, VOFF); drawParallax(cx, bs); ctx.restore();
    ctx.save(); ctx.translate(-cx, VOFF);
    drawPits(bs); drawPlatforms(bs); drawDecals(); drawTorches(bs); drawCoins();
    if (theKey) drawKey();
    drawNotes();
    for (const e of enemies) drawEnemy(e);
    if (boss) drawBoss();
    drawPrincess();
    for (const b of blasts) drawBlast(b);
    drawPlayer();
    drawParticles(); drawFloaters();
    ctx.restore();
    ctx.save(); ctx.translate(0, VOFF); drawFireflies(cx, bs); ctx.restore();
    ctx.restore();

    // post fx (full canvas → VH so they cover the whole responsive viewport)
    if (beatFlash > 0.02 && state === 'play') { ctx.fillStyle = (rageOn ? 'rgba(255,31,46,' : 'rgba(141,255,43,') + (beatFlash * 0.06) + ')'; ctx.fillRect(0, 0, W, VH); }
    if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flash / 16) + ')'; ctx.fillRect(0, 0, W, VH); }
    if (rageOn) { ctx.fillStyle = 'rgba(255,31,46,0.07)'; ctx.fillRect(0, 0, W, VH); ctx.fillStyle = 'rgba(255,31,46,' + (0.05 + bs * 0.05) + ')'; ctx.fillRect(0, 0, W, 6); ctx.fillRect(0, VH - 6, W, 6); }
    drawBossBar();
    if (state === 'paused') drawPausedOverlay();
  }

  function drawSky(bs) {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    if (rageOn) { g.addColorStop(0, '#2a0410'); g.addColorStop(.5, '#1a0208'); g.addColorStop(1, '#070103'); }
    else { g.addColorStop(0, '#0c2e16'); g.addColorStop(.45, '#0a2110'); g.addColorStop(1, '#05150b'); }
    ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, VH + 60);
    // 808 EMERALD moon — pulses with the live track
    const mx = W * 0.80, my = VH * 0.2, mr = 24 + bs * 7;
    const mg = ctx.createRadialGradient(mx, my, 2, mx, my, mr * 2.6);
    if (rageOn) { mg.addColorStop(0, 'rgba(255,90,100,.95)'); mg.addColorStop(.4, 'rgba(255,31,46,.4)'); mg.addColorStop(1, 'transparent'); }
    else { mg.addColorStop(0, 'rgba(190,255,150,.9)'); mg.addColorStop(.4, 'rgba(141,255,43,' + (0.3 + bs * 0.25) + ')'); mg.addColorStop(1, 'transparent'); }
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr * 2.6, 0, 6.28); ctx.fill();
    // emerald facets
    ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.sin(timeNow * 0.0004) * 0.2);
    const eg = ctx.createLinearGradient(-mr, -mr, mr, mr);
    eg.addColorStop(0, rageOn ? '#ff8a92' : '#e6ffce'); eg.addColorStop(1, rageOn ? '#ff2a3a' : '#62d11a');
    ctx.fillStyle = eg; ctx.beginPath();
    ctx.moveTo(0, -mr); ctx.lineTo(mr * 0.86, -mr * 0.3); ctx.lineTo(mr * 0.6, mr * 0.9); ctx.lineTo(-mr * 0.6, mr * 0.9); ctx.lineTo(-mr * 0.86, -mr * 0.3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -mr); ctx.lineTo(0, mr * 0.9); ctx.moveTo(-mr * 0.86, -mr * 0.3); ctx.lineTo(mr * 0.86, -mr * 0.3); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-mr * 0.5, -mr * 0.55, 3, 3);
    ctx.restore();
    // stars
    for (let i = 0; i < 44; i++) { const sxp = (i * 137) % W, syp = (i * 71) % (VH * 0.62); ctx.fillStyle = 'rgba(200,255,190,' + (0.2 + 0.5 * ((Math.sin(timeNow * 0.002 + i) + 1) / 2)) + ')'; ctx.fillRect(sxp, syp, 1, 1); }
  }
  function drawParallax(cx, bs) {
    const layers = [{ s: 0.2, col: rageOn ? '#240310' : '#08200f', h: 92, amp: 30 },
    { s: 0.4, col: rageOn ? '#350518' : '#0b3015', h: 72, amp: 22 },
    { s: 0.62, col: rageOn ? '#470820' : '#0f421d', h: 52, amp: 16 }];
    for (const L of layers) {
      ctx.save(); ctx.translate(-cx * L.s, 0); ctx.fillStyle = L.col;
      ctx.beginPath(); ctx.moveTo(-40, H);
      for (let x = -40; x < W + 80; x += 20) { const y = H - L.h - Math.sin((x + cx * L.s) * 0.01) * L.amp - (L === layers[2] ? bs * 5 : 0); ctx.lineTo(x, y); } ctx.lineTo(W + 80, H); ctx.closePath(); ctx.fill();
      if (L.s > 0.6) {
        ctx.strokeStyle = rageOn ? 'rgba(255,31,46,' + (0.2 + bs * 0.3) + ')' : 'rgba(141,255,43,' + (0.2 + bs * 0.35) + ')'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-40, H - L.h);
        for (let x = -40; x < W + 80; x += 20) { const y = H - L.h - Math.sin((x + cx * L.s) * 0.01) * L.amp; ctx.lineTo(x, y); } ctx.stroke();
      }
      ctx.restore();
    }
    // Static Castle towers in the mid-distance (parallax 0.5), only visible toward the end
    drawCastle(cx, bs);
    // floating emerald orbs reacting to the beat
    ctx.save(); ctx.translate(-cx * 0.5, 0);
    for (let i = 0; i < 18; i++) { const ox = 80 + i * 200, oy = 50 + (i % 4) * 26 + Math.sin(timeNow * 0.001 + i) * 6, r = 1.5 + bs * 2.8; ctx.fillStyle = rageOn ? 'rgba(255,60,80,' + (0.3 + bs * 0.4) + ')' : 'rgba(120,255,90,' + (0.3 + bs * 0.4) + ')'; ctx.beginPath(); ctx.arc(ox, oy, r, 0, 6.28); ctx.fill(); }
    ctx.restore();
  }
  function drawCastle(cx, bs) {
    const par = 0.55, sx = 3060 * 1 - cx * par - 40; // screen x of the castle base
    if (sx > W + 120 || sx < -260) return;
    ctx.save(); ctx.translate(sx, 0);
    const baseY = H - 64, col = rageOn ? '#1c0510' : '#0c2418', edge = rageOn ? '#3a0a1c' : '#16402a';
    // big keep
    ctx.fillStyle = col; ctx.fillRect(40, baseY - 70, 70, 90);
    ctx.fillStyle = col; ctx.fillRect(0, baseY - 40, 36, 60); ctx.fillRect(116, baseY - 46, 34, 66);
    // crenellations
    ctx.fillStyle = edge; for (let i = 0; i < 5; i++) ctx.fillRect(42 + i * 14, baseY - 76, 8, 8);
    // glowing windows pulsing with the music
    const wg = rageOn ? 'rgba(255,40,60,' : 'rgba(141,255,43,'; ctx.fillStyle = wg + (0.5 + bs * 0.5) + ')';
    ctx.fillRect(58, baseY - 56, 7, 12); ctx.fillRect(82, baseY - 56, 7, 12); ctx.fillRect(70, baseY - 34, 8, 16);
    ctx.fillStyle = wg + (0.3 + bs * 0.4) + ')'; ctx.fillRect(12, baseY - 26, 6, 10); ctx.fillRect(126, baseY - 30, 6, 10);
    // spire tops
    ctx.fillStyle = rageOn ? C.rage : C.slimeDeep; ctx.beginPath(); ctx.moveTo(0, baseY - 40); ctx.lineTo(18, baseY - 58); ctx.lineTo(36, baseY - 40); ctx.fill();
    ctx.beginPath(); ctx.moveTo(116, baseY - 46); ctx.lineTo(133, baseY - 66); ctx.lineTo(150, baseY - 46); ctx.fill();
    ctx.restore();
  }
  function drawPits(bs) {
    for (const pit of pits) {
      const grad = ctx.createLinearGradient(0, WB - 40, 0, WB);
      if (rageOn) { grad.addColorStop(0, 'rgba(255,31,46,.6)'); grad.addColorStop(1, 'rgba(120,0,15,.9)'); }
      else { grad.addColorStop(0, 'rgba(141,255,43,.55)'); grad.addColorStop(1, 'rgba(8,50,15,.95)'); }
      ctx.fillStyle = grad;
      for (let x = 0; x < pit[1]; x += 4) { const wv = Math.sin((x + timeNow * 0.005) * 0.25) * 2.5 + Math.sin((x + timeNow * 0.009) * 0.6) * 1.5; ctx.fillRect(pit[0] + x, GY + 2 + wv, 4, WB - GY); }
      for (let i = 0; i < 5; i++) { const bx = pit[0] + 10 + ((i * 23 + timeNow * 0.03) % (pit[1] - 20)); const by = WB - 10 - ((timeNow * 0.05 + i * 40) % 30); ctx.fillStyle = rageOn ? 'rgba(255,120,130,.6)' : 'rgba(160,255,122,.6)'; ctx.beginPath(); ctx.arc(bx, by, 1.5, 0, 6.28); ctx.fill(); }
    }
  }
  function drawPlatforms(bs) {
    for (const pl of plats) {
      const tall = pl.y === GY;
      const g = ctx.createLinearGradient(0, pl.y, 0, tall ? WB : pl.y + 16);
      g.addColorStop(0, rageOn ? '#3a1018' : '#15401c'); g.addColorStop(1, rageOn ? '#1a050a' : '#082611');
      ctx.fillStyle = g; ctx.fillRect(pl.x, pl.y, pl.w, tall ? WB - pl.y : 16);
      ctx.fillStyle = rageOn ? '#52131f' : '#1d5226';
      for (let x = pl.x + 4; x < pl.x + pl.w; x += 12) { const yy = pl.y + 8 + ((x * 7) % (tall ? 40 : 8)); ctx.fillRect(x, yy, 2, 2); }
      ctx.fillStyle = rageOn ? '#7a1228' : C.slimeDeep; ctx.fillRect(pl.x, pl.y, pl.w, 5);
      ctx.fillStyle = rageOn ? C.rage : C.slime; ctx.fillRect(pl.x, pl.y, pl.w, 2);
      const glow = 0.25 + bs * 0.55; ctx.fillStyle = rageOn ? 'rgba(255,31,46,' + glow + ')' : 'rgba(141,255,43,' + glow + ')'; ctx.fillRect(pl.x, pl.y - 2, pl.w, 2);
      for (let x = pl.x + 3; x < pl.x + pl.w; x += 7) { const bl = 2 + ((x * 3) % 3); ctx.fillStyle = rageOn ? C.rageSoft : C.slimeBright; ctx.fillRect(x, pl.y - bl, 1, bl); }
      for (let x = pl.x + 10; x < pl.x + pl.w; x += 40) { const dl = 4 + Math.sin((x + timeNow * 0.003)) * 3; ctx.fillStyle = rageOn ? 'rgba(255,31,46,.5)' : 'rgba(141,255,43,.45)'; ctx.fillRect(x, pl.y + 5, 2, dl); ctx.beginPath(); ctx.arc(x + 1, pl.y + 5 + dl, 1.5, 0, 6.28); ctx.fill(); }
    }
  }
  function drawDecals() {
    for (const d of decals) {
      d.f += 0.02;
      if (d.type === 'mush') {
        const sw = Math.sin(d.f) * 1;
        rr(d.x - 1 + sw * 0.3, d.y - 8 * d.s, 3, 8 * d.s, '#c9bcae');
        ctx.fillStyle = rageOn ? C.rage : C.slime; ctx.beginPath(); ctx.ellipse(d.x + sw, d.y - 9 * d.s, 5 * d.s, 3.5 * d.s, 0, 0, 6.28); ctx.fill();
        ctx.fillStyle = rageOn ? '#ff9aa6' : C.slimeBright; ctx.fillRect(d.x - 2 + sw, d.y - 10 * d.s, 1, 1); ctx.fillRect(d.x + 1 + sw, d.y - 11 * d.s, 1, 1);
      } else { rr(d.x - 3, d.y - 4, 7, 4, rageOn ? '#3a1018' : '#2a3a2c'); rr(d.x - 2, d.y - 5, 4, 2, rageOn ? '#52131f' : '#3a4f3c'); }
    }
  }
  function drawTorches(bs) {
    for (const t of torches) {
      t.t += 0.12;
      rr(t.x - 1, t.y - 22, 3, 20, '#3a2a1a');
      const fy = t.y - 24 + Math.sin(t.t) * 1, fr = 4 + Math.sin(t.t * 1.7) * 1.5 + bs * 3;
      const g = ctx.createRadialGradient(t.x, fy, 1, t.x, fy, fr * 3);
      if (rageOn) { g.addColorStop(0, '#fff0c0'); g.addColorStop(.4, 'rgba(255,31,46,.7)'); g.addColorStop(1, 'transparent'); }
      else { g.addColorStop(0, '#eaffd2'); g.addColorStop(.4, 'rgba(141,255,43,.65)'); g.addColorStop(1, 'transparent'); }
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(t.x, fy, fr * 3, 0, 6.28); ctx.fill();
      ctx.fillStyle = rageOn ? C.rage : C.slime; ctx.beginPath(); ctx.arc(t.x, fy, fr * 0.8, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(t.x, fy + 0.5, fr * 0.35, 0, 6.28); ctx.fill();
    }
  }
  function drawCoins() {
    for (const c of coins) {
      if (c.got) continue; const fl = Math.sin(c.bob) * 2.5;
      if (c.shard) {
        ctx.save(); ctx.translate(c.x, c.y + fl); ctx.rotate(timeNow * 0.003);
        const g = ctx.createLinearGradient(-6, -6, 6, 6); g.addColorStop(0, C.goldLt); g.addColorStop(1, C.gold);
        ctx.fillStyle = g; ctx.shadowColor = C.gold; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 6); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.fillRect(-1, -3, 2, 2); ctx.restore();
      } else {
        ctx.save(); ctx.translate(c.x, c.y + fl);
        const sc = 0.7 + Math.abs(Math.sin(timeNow * 0.004 + c.bob)) * 0.3; ctx.scale(sc, 1);
        ctx.fillStyle = C.slime; ctx.shadowColor = C.slime; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 6.28); ctx.fill();
        ctx.fillStyle = C.slimeBright; ctx.beginPath(); ctx.arc(-1.2, -1.2, 1.5, 0, 6.28); ctx.fill();
        ctx.shadowBlur = 0; ctx.restore();
      }
    }
  }
  function drawKey() {
    const k = theKey, fl = Math.sin(k.t) * 3.5;
    ctx.save(); ctx.translate(k.x, k.y + fl); ctx.shadowColor = C.slime; ctx.shadowBlur = 16;
    ctx.fillStyle = C.slime; ctx.beginPath(); ctx.arc(0, -7, 6, 0, 6.28); ctx.fill();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(0, -7, 2.5, 0, 6.28); ctx.fill();
    ctx.fillStyle = C.slime; ctx.fillRect(-2, -3, 4, 14); ctx.fillRect(2, 7, 5, 3); ctx.fillRect(2, 11, 4, 3);
    ctx.fillStyle = C.slimeBright; ctx.fillRect(-3, -9, 2, 2);
    ctx.shadowBlur = 0; ctx.restore();
    for (let i = 0; i < 3; i++) { const a = k.t * 1.5 + i * 2.1; ctx.fillStyle = 'rgba(160,255,122,.7)'; ctx.fillRect(k.x + Math.cos(a) * 11, k.y + fl + Math.sin(a) * 11, 1.5, 1.5); }
  }
  function drawNotes() {
    for (const n of notes) {
      if (n.kind === 'shock') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowBlur = 10; ctx.shadowColor = C.rage;
        const r = 4 + Math.sin(n.t * 6) * 1.2; ctx.fillStyle = C.rageSoft; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.4, 0, 6.28); ctx.fill();
        ctx.restore(); continue;
      }
      const red = n.kind === 'red'; const yy = n.y + (red ? 0 : Math.sin(n.t) * 4);
      ctx.save(); ctx.shadowBlur = 9; ctx.shadowColor = red ? C.rage : C.toxic; ctx.fillStyle = red ? C.rage : C.toxic;
      ctx.fillRect(n.x - 1.5, yy - 7, 3, 11); ctx.beginPath(); ctx.arc(n.x - 2.5, yy + 4, 2.8, 0, 6.28); ctx.fill();
      ctx.fillRect(n.x + 1, yy - 8, 3, 2); ctx.restore();
    }
  }
  function drawFireflies(cx, bs) {
    // halo = a second, bigger translucent arc — not ctx.shadowBlur (a per-fly Gaussian
    // blur every frame, one of the slowest canvas paths in Chrome's raster)
    ctx.save();
    for (const f of fireflies) { const sxp = f.x - cx; if (sxp < -10 || sxp > W + 10) continue; const a = 0.3 + 0.5 * ((Math.sin(f.t) + 1) / 2); const fy = f.y + Math.sin(f.t * 1.3) * 4, fr = f.r + bs * 0.8;
      ctx.fillStyle = rageOn ? 'rgba(255,90,100,' + (a * 0.3).toFixed(3) + ')' : 'rgba(180,255,120,' + (a * 0.3).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(sxp, fy, fr + 2.5, 0, 6.28); ctx.fill();
      ctx.fillStyle = rageOn ? 'rgba(255,90,100,' + a + ')' : 'rgba(180,255,120,' + a + ')';
      ctx.beginPath(); ctx.arc(sxp, fy, fr, 0, 6.28); ctx.fill(); }
    ctx.restore();
  }

  /* ----- Slime By hero (upgraded, beat-reactive) -----
     Rendered to an offscreen buffer first so we can stamp a crisp dark toon outline
     around him — the biggest readability win against the busy, glowing backdrop.
     pcan = the sprite, scan = its silhouette used for the outline pass. */
  const PCW = 76, PCH = 112, POX = 38, POY = 98;
  let pcan = null, pctx = null, scan = null, sctx = null;
  function ensurePbuf() {
    if (pcan && pctx) return;
    pcan = document.createElement('canvas'); pcan.width = PCW; pcan.height = PCH;
    pctx = pcan.getContext('2d'); pctx.imageSmoothingEnabled = false;
    scan = document.createElement('canvas'); scan.width = PCW; scan.height = PCH;
    sctx = scan.getContext('2d'); sctx.imageSmoothingEnabled = false;
  }
  function drawPlayer() {
    const p = player;
    // dash afterimages
    for (const tr of p.trail) {
      ctx.save(); ctx.globalAlpha = (tr.life / 10) * 0.4; ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rageOn ? C.rage : C.slime; ctx.fillRect(tr.x + 4, tr.y + 6, 14, 34); ctx.restore();
    }
    // ground shadow (tightens + lifts while airborne for a sense of height)
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,' + (p.onGround ? 0.4 : 0.15) + ')';
    ctx.beginPath(); ctx.ellipse(p.x + p.w / 2, p.y + p.h - 1, 12 * (p.onGround ? 1 : 0.78), 4 * (p.onGround ? 1 : 0.7), 0, 0, 6.28); ctx.fill(); ctx.restore();

    const bob = Math.sin(p.bob) * 1.2;
    const breath = 1 + Math.sin(p.bob * 0.5) * 0.014;             // gentle idle breathing
    const lean = Math.max(-0.17, Math.min(0.17, p.vx * 0.023));   // lean into the run
    const sq = p.squash, sxsc = 1 / Math.max(0.6, sq), sysc = sq * breath;

    // beat aura — drawn on the MAIN ctx, behind the sprite, so it never bloats the outline
    const auraR = 16 + p.aura * 8, acx = p.x + p.w / 2, acy = p.y + p.h - 22;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const ag = ctx.createRadialGradient(acx, acy, 2, acx, acy, auraR * 1.6);
    ag.addColorStop(0, (rageOn ? 'rgba(255,40,55,' : 'rgba(141,255,43,') + (0.2 + p.aura * 0.18) + ')'); ag.addColorStop(1, 'transparent');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(acx, acy, auraR * 1.6, 0, 6.28); ctx.fill(); ctx.restore();

    // ---- render the character into the offscreen buffer ----
    ensurePbuf();
    const realCtx = ctx;
    pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, PCW, PCH);
    ctx = pctx;                                                   // redirect rr()/drawing into the buffer
    ctx.save();
    ctx.translate(POX, POY + bob); ctx.scale(p.dir, 1); ctx.rotate(lean * p.dir); ctx.scale(sxsc, sysc);

    const stride = Math.sin(p.walk) * 4 * Math.min(1, Math.abs(p.vx) / 2);
    const air = !p.onGround;
    const lLegX = -5, rLegX = 2;
    const legSwingL = air ? -3 : stride, legSwingR = air ? 3 : -stride;
    // shoes (Jordan 1 bred)
    drawShoe(lLegX - 1, -2, legSwingL); drawShoe(rLegX + 1, -2, legSwingR);
    // shins
    rr(lLegX, -16, 5, 14, C.skin); rr(lLegX, -16, 2, 14, C.skinSh);
    rr(rLegX, -16, 5, 14, C.skin); rr(rLegX + 3, -16, 2, 14, C.skinLt);
    // shorts (black w/ blue stripe)
    rr(-7, -26, 15, 12, rageOn ? '#1a0307' : '#101012'); rr(-7, -26, 15, 2, '#1d1d22');
    rr(-7, -26, 2, 12, C.sbBlue); rr(6, -26, 2, 12, C.sbBlue); rr(-1, -26, 2, 11, '#000');
    // torso (black tee)
    const tY = -44;
    rr(-8, tY, 16, 20, rageOn ? '#1c0409' : '#0e0e10'); rr(-8, tY, 16, 2, '#17171b');
    rr(7, tY + 2, 1, 18, '#050506'); rr(-8, tY + 2, 1, 18, '#1c1c20');
    // tee sheen — a soft beat-reactive highlight down the left of the chest
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = (rageOn ? 'rgba(255,70,85,' : 'rgba(141,255,43,') + (0.05 + QA.beatStrength() * 0.13) + ')'; ctx.fillRect(-6, tY + 2, 3, 16); ctx.restore();
    // chain (sways with bob)
    const chSw = Math.sin(p.bob * 0.8) * 1.2;
    ctx.fillStyle = '#e4e4f0'; for (let i = -4; i <= 4; i += 2) ctx.fillRect(i + chSw * 0.2, tY + 1 + Math.abs(i) * 0.35, 1.5, 1.5);
    ctx.fillStyle = C.gold; ctx.fillRect(-1 + chSw * 0.2, tY + 4, 3, 3); // SB pendant
    // blue SB graphic
    ctx.fillStyle = C.sbBlue; ctx.fillRect(-4, tY + 9, 8, 7);
    ctx.fillStyle = C.sbBlueLite; ctx.fillRect(-3, tY + 10, 2, 5); ctx.fillRect(1, tY + 10, 2, 5);
    ctx.fillStyle = '#fff'; ctx.fillRect(-3, tY + 10, 1, 5); ctx.fillRect(2, tY + 10, 1, 5);
    // arms
    const armSwing = air ? 2 : Math.sin(p.walk) * 3 * Math.min(1, Math.abs(p.vx) / 2);
    rr(-10, tY + 3, 4, 9, '#0a0a0c'); rr(-10, tY + 11, 4, 9, C.skinSh);
    const ax = 7;
    rr(ax, tY + 3, 4, 9, rageOn ? '#1c0409' : '#0e0e10');
    rr(ax, tY + 11, 4, 8 + armSwing * 0.4, C.skin); rr(ax + 3, tY + 11, 1, 8, C.skinLt);
    // mic
    if (p.atkT > 0) {
      rr(ax + 1, tY + 6, 3, 3, '#888'); rr(ax + 1, tY + 3, 3, 3, C.slime);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(141,255,43,.55)'; ctx.beginPath(); ctx.arc(ax + 2, tY + 2, 5, 0, 6.28); ctx.fill(); ctx.restore();
    } else { rr(ax + 2, tY + 16, 3, 4, '#888'); rr(ax + 2, tY + 19, 4, 3, rageOn ? C.rage : C.slime); }
    // head
    const hY = tY - 16;
    ctx.fillStyle = C.beard; rr(-7, hY + 9, 15, 9, C.beard);
    rr(-6, hY + 2, 13, 12, C.skin); rr(4, hY + 2, 3, 12, C.skinSh); rr(-6, hY + 2, 2, 12, C.skinLt);
    ctx.fillStyle = C.beard; rr(-6, hY + 10, 13, 7, C.beard); rr(-5, hY + 15, 11, 3, C.beard);
    rr(0, hY + 11, 4, 1, '#5a2f18');
    rr(2, hY + 5, 3, 1, '#120c08');
    if (p.blink > 0) { rr(3, hY + 7, 2, 1, '#2a1a10'); } else { rr(2, hY + 6, 3, 3, '#fff'); rr(4, hY + 6, 1, 3, rageOn ? C.rage : '#241a3a'); rr(2, hY + 6, 1, 1, '#cfe'); }
    rr(6, hY + 8, 2, 2, C.skinSh); rr(-6, hY + 7, 2, 3, C.skinSh);
    // locs (sway)
    ctx.fillStyle = C.hair; const locSw = stride * 0.4 + Math.sin(p.bob) * 0.6;
    for (let i = 0; i < 4; i++) { const ly = hY + 4 + i * 4; rr(-10 - locSw * (i / 4), ly, 4, 5, C.hair); rr(-9 - locSw * (i / 4), ly + 1, 1, 3, '#2a1d12'); }
    rr(-8, hY + 2, 4, 12, C.hair);
    // SB snapback (blue)
    const cY = hY - 1;
    rr(-7, cY - 3, 15, 6, C.sbBlue); rr(-7, cY - 3, 15, 2, C.sbBlueLite); rr(-8, cY - 2, 1, 5, C.sbBlueDk);
    rr(-7, cY + 2, 16, 2, '#1a2f8a'); rr(2, cY + 1, 12, 3, C.sbBlue); rr(2, cY + 3, 12, 1, C.sbBlueDk);
    ctx.fillStyle = '#fff'; ctx.fillRect(-1, cY - 2, 3, 3); ctx.fillStyle = C.sbBlueLite; ctx.fillRect(0, cY - 1, 1, 1);
    // rim light on the beat (thin, inside the body box so it stays out of the silhouette)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = (rageOn ? 'rgba(255,31,46,' : 'rgba(141,255,43,') + (0.14 + QA.beatStrength() * 0.34) + ')'; ctx.lineWidth = 1; ctx.strokeRect(-9, hY - 4, 19, 60); ctx.restore();
    ctx.restore();
    ctx = realCtx;                                                // back to the main target

    // ---- toon outline: build the silhouette, stamp it around the sprite, then the sprite ----
    const ox = (p.x + p.w / 2) - POX, oy = (p.y + p.h) - POY;
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, PCW, PCH);
    sctx.globalCompositeOperation = 'source-over'; sctx.drawImage(pcan, 0, 0);
    sctx.globalCompositeOperation = 'source-in'; sctx.fillStyle = rageOn ? '#1c0206' : '#03100a'; sctx.fillRect(0, 0, PCW, PCH);
    sctx.globalCompositeOperation = 'source-over';
    ctx.save();
    if (p.inv > 0 && Math.floor(p.inv / 4) % 2 === 0) ctx.globalAlpha = 0.4;
    const o = 1.5, off = [[o, 0], [-o, 0], [0, o], [0, -o], [o, o], [-o, -o], [o, -o], [-o, o]];
    for (const d of off) ctx.drawImage(scan, ox + d[0], oy + d[1]);
    ctx.drawImage(pcan, ox, oy);
    ctx.restore();

    // rage venom drips
    if (rageOn && Math.random() < 0.3) particles.push({ x: p.x + 4 + Math.random() * 14, y: p.y + 40, vx: 0, vy: 0.4, life: 22, max: 22, col: C.rage, size: 2, grav: 0.12, glow: 1, shape: 'goo' });
  }
  function drawShoe(x, y, swing) {
    ctx.save(); ctx.translate(x, y + (swing < 0 ? -Math.abs(swing) * 0.4 : 0));
    rr(-2, -3, 9, 4, '#161616'); rr(-2, 0, 10, 2, '#fff'); rr(-2, 1, 10, 2, '#c0202c');
    rr(4, -3, 3, 4, C.rage); rr(-2, -3, 2, 4, C.rage); rr(0, -2, 2, 1, '#fff');
    ctx.restore();
  }
  function drawBlast(b) {
    ctx.save(); const col = b.big ? C.toxic : C.slime; ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = col; ctx.shadowBlur = 14;
    const a = Math.min(1, b.life / 9), gw = b.w * b.grew;
    ctx.fillStyle = 'rgba(' + (b.big ? '214,255,56' : '141,255,43') + ',' + (a * 0.5) + ')'; ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, gw / 2 + 4, b.h / 2 + 3, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = 'rgba(' + (b.big ? '255,255,200' : '194,255,122') + ',' + a + ')'; ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, gw / 2 * 0.7, b.h / 2 * 0.6, 0, 0, 6.28); ctx.fill();
    ctx.strokeStyle = 'rgba(' + (b.big ? '214,255,56' : '141,255,43') + ',' + (a * 0.6) + ')'; ctx.lineWidth = 1.5;
    for (let i = 1; i <= 2; i++) { ctx.beginPath(); ctx.arc(b.x + b.w / 2 - b.dir * i * 5, b.y + b.h / 2, b.h / 2 * 0.5 * i, b.dir > 0 ? -1 : 2.1, b.dir > 0 ? 1 : 4.2); ctx.stroke(); }
    ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over'; ctx.restore();
  }
  function drawEnemy(e) {
    const x = e._x, y = e._y;
    ctx.save(); ctx.globalAlpha = e.dead ? Math.max(0, e.fade) : 1; ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(e.w / 2, e.h + 1, e.w * 0.4, 2.5, 0, 0, 6.28); ctx.fill();
    if (e.type === 'mite') {
      const sq = 1 + Math.sin(e.t * 3) * 0.16;
      ctx.save(); ctx.translate(e.w / 2, e.h); ctx.scale(1 / sq, sq); ctx.translate(-e.w / 2, -e.h);
      // gooey translucent body
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rageOn ? 'rgba(255,40,55,.25)' : 'rgba(141,255,43,.22)'; ctx.beginPath(); ctx.ellipse(e.w / 2, e.h * 0.6, e.w / 2 + 2, e.h * 0.6, 0, 0, 6.28); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createLinearGradient(0, 0, 0, e.h); g.addColorStop(0, rageOn ? '#ff5a6e' : '#5bd97a'); g.addColorStop(1, rageOn ? '#7a0c1a' : '#15662f');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(e.w / 2, e.h * 0.6, e.w / 2, e.h * 0.55, 0, 0, 6.28); ctx.fill();
      // little feet
      ctx.fillStyle = rageOn ? '#7a0c1a' : '#15662f'; ctx.fillRect(e.w * 0.2, e.h - 2, 3, 3); ctx.fillRect(e.w * 0.65, e.h - 2, 3, 3);
      // gloss + eyes
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(e.w * 0.35, e.h * 0.35, 3, 2, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(e.w * 0.3, e.h * 0.45, 3, 3); ctx.fillRect(e.w * 0.62, e.h * 0.45, 3, 3);
      ctx.fillStyle = rageOn ? '#220' : '#0a2a12'; ctx.fillRect(e.w * 0.34, e.h * 0.5, 1.5, 1.5); ctx.fillRect(e.w * 0.66, e.h * 0.5, 1.5, 1.5);
      // drip
      const dl = 1.5 + Math.sin(e.t * 2 + 1) * 1.5; ctx.fillStyle = rageOn ? '#ff5a6e' : '#5bd97a'; ctx.fillRect(e.w * 0.5 - 1, e.h * 0.95, 2, dl);
      ctx.restore();
    }
    if (e.type === 'bat') {
      const f = Math.sin(e.flap) * 6;
      // static jitter
      const jx = rageOn ? (Math.random() - .5) * 2 : 0;
      ctx.save(); ctx.translate(jx, 0);
      ctx.fillStyle = rageOn ? '#5a0010' : '#2a1a3a';
      ctx.beginPath(); ctx.ellipse(e.w / 2, e.h / 2, e.w * 0.28, e.h * 0.55, 0, 0, 6.28); ctx.fill();
      // wings
      ctx.fillStyle = rageOn ? '#3a0010' : '#1e1230';
      ctx.beginPath(); ctx.moveTo(e.w * 0.3, e.h * 0.4); ctx.quadraticCurveTo(-6, e.h * 0.5 - f, -3, e.h + 2); ctx.quadraticCurveTo(e.w * 0.2, e.h * 0.7, e.w * 0.35, e.h * 0.6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(e.w * 0.7, e.h * 0.4); ctx.quadraticCurveTo(e.w + 6, e.h * 0.5 - f, e.w + 3, e.h + 2); ctx.quadraticCurveTo(e.w * 0.8, e.h * 0.7, e.w * 0.65, e.h * 0.6); ctx.fill();
      // wing edge glow
      ctx.strokeStyle = rageOn ? 'rgba(255,31,46,.5)' : 'rgba(155,60,255,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3, e.h + 2); ctx.lineTo(e.w * 0.3, e.h * 0.4); ctx.moveTo(e.w + 3, e.h + 2); ctx.lineTo(e.w * 0.7, e.h * 0.4); ctx.stroke();
      // eyes
      ctx.fillStyle = rageOn ? C.gold : '#ff4060'; ctx.shadowColor = rageOn ? C.gold : C.rage; ctx.shadowBlur = 5; ctx.fillRect(e.w * 0.35, e.h * 0.38, 2, 2); ctx.fillRect(e.w * 0.58, e.h * 0.38, 2, 2); ctx.shadowBlur = 0;
      // fangs
      ctx.fillStyle = '#fff'; ctx.fillRect(e.w * 0.42, e.h * 0.62, 1, 2); ctx.fillRect(e.w * 0.54, e.h * 0.62, 1, 2);
      ctx.restore();
    }
    if (e.type === 'serpent') {
      ctx.shadowColor = C.rage; ctx.shadowBlur = 8;
      for (let i = 0; i < 5; i++) {
        const yy = Math.sin(e.t * 3 + i * 0.8) * 3;
        const g = ctx.createLinearGradient(0, 0, 0, e.h); g.addColorStop(0, '#ff556a'); g.addColorStop(1, '#9a0c1c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(i * 5 + 3, e.h / 2 + yy, 4.2, e.h * 0.46, 0, 0, 6.28); ctx.fill();
        ctx.fillStyle = 'rgba(255,180,190,.35)'; ctx.fillRect(i * 5 + 1, e.h / 2 + yy - 3, 2, 2);
      }
      const hx = e.vx > 0 ? e.w - 3 : 3, hd = e.vx > 0 ? 1 : -1;
      // hood
      ctx.fillStyle = '#c0101e'; ctx.beginPath(); ctx.ellipse(hx, e.h * 0.42, 5.5, 4.5, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#ff6e80'; ctx.beginPath(); ctx.ellipse(hx, e.h * 0.4, 4, 3.5, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = C.toxic; ctx.shadowColor = C.toxic; ctx.shadowBlur = 5; ctx.fillRect(hx + hd - 1, e.h * 0.3, 2, 2); ctx.shadowBlur = 0;
      ctx.fillStyle = '#3a0008'; ctx.fillRect(hx + hd - 0.5, e.h * 0.32, 1, 1);
      if (Math.sin(e.t * 4) > 0.5) { ctx.strokeStyle = C.rage; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx + hd * 3, e.h * 0.45); ctx.lineTo(hx + hd * 7, e.h * 0.42); ctx.lineTo(hx + hd * 6, e.h * 0.5); ctx.stroke(); }
      ctx.shadowBlur = 0;
    }
    if (e.type === 'amp') {
      // a busted SB speaker cabinet that fires on the beat
      const pulse = e.glow;
      // cone telegraph
      if (e.cone > 0.05) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = e.cone * 0.5; ctx.fillStyle = C.rageSoft; ctx.beginPath(); ctx.moveTo(e.w / 2, e.h * 0.5); ctx.lineTo(e.w / 2 + 60, e.h * 0.2); ctx.lineTo(e.w / 2 + 60, e.h * 0.8); ctx.fill(); ctx.beginPath(); ctx.moveTo(e.w / 2, e.h * 0.5); ctx.lineTo(e.w / 2 - 60, e.h * 0.2); ctx.lineTo(e.w / 2 - 60, e.h * 0.8); ctx.fill(); ctx.restore(); }
      // cabinet
      const g = ctx.createLinearGradient(0, 0, 0, e.h); g.addColorStop(0, '#1a1a22'); g.addColorStop(1, '#0a0a10');
      ctx.fillStyle = g; ctx.fillRect(1, 0, e.w - 2, e.h);
      ctx.fillStyle = '#2a2a36'; ctx.fillRect(1, 0, e.w - 2, 2);
      ctx.strokeStyle = '#3a3a48'; ctx.lineWidth = 1; ctx.strokeRect(1.5, 0.5, e.w - 3, e.h - 1);
      // woofer that bumps on the beat
      const wr = 6 + pulse * 2;
      ctx.fillStyle = '#15151c'; ctx.beginPath(); ctx.arc(e.w / 2, e.h * 0.5, 8, 0, 6.28); ctx.fill();
      const wg = ctx.createRadialGradient(e.w / 2, e.h * 0.5, 1, e.w / 2, e.h * 0.5, wr);
      wg.addColorStop(0, rageOn ? '#ff5a6e' : '#8dff2b'); wg.addColorStop(1, '#101018');
      ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(e.w / 2, e.h * 0.5, wr, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#050507'; ctx.beginPath(); ctx.arc(e.w / 2, e.h * 0.5, 2 + pulse, 0, 6.28); ctx.fill();
      // SB badge + tweeter
      ctx.fillStyle = pulse > 0.3 ? C.rage : '#444'; ctx.fillRect(e.w / 2 - 3, 3, 6, 4);
      // glow ring on the beat
      if (pulse > 0.2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,40,55,' + pulse + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.w / 2, e.h * 0.5, wr + 3 + pulse * 4, 0, 6.28); ctx.stroke(); ctx.restore(); }
    }
    ctx.restore();
  }
  function drawBoss() {
    const b = boss; ctx.save(); ctx.translate(b.x, b.y);
    if (b.hurt > 0 && Math.floor(b.hurt / 3) % 2 === 0) ctx.globalAlpha = 0.65;
    const rear = b.rear > 0 ? -b.rear * 0.4 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(b.w / 2, b.h + 2, b.w * 0.45, 4, 0, 0, 6.28); ctx.fill();
    ctx.shadowColor = C.rage; ctx.shadowBlur = 18 + b.sx;
    // coiled, scaled body
    for (let i = 0; i < 7; i++) {
      const yy = Math.sin(b.t * 2 + i * 0.7) * 6, xx = i * 9 + b.sx * Math.sin(i);
      const g = ctx.createLinearGradient(0, 0, 0, b.h); g.addColorStop(0, b.hurt > 0 ? '#ff8a96' : '#e62740'); g.addColorStop(1, b.hurt > 0 ? '#c0303a' : '#7a0816');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(xx + 7, b.h * 0.6 + yy, 8, b.h * 0.42, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = 'rgba(255,190,200,.4)'; ctx.fillRect(xx + 4, b.h * 0.36 + yy, 3, 3);
      ctx.fillStyle = '#5a0410'; ctx.fillRect(xx + 9, b.h * 0.6 + yy - 1, 2, 4); // scale seam
    }
    // head (rears up when winding a lunge)
    ctx.save(); ctx.translate(b.w - 12, b.h * 0.42 + rear);
    const g2 = ctx.createLinearGradient(-12, 0, 12, 0); g2.addColorStop(0, '#ff3850'); g2.addColorStop(1, '#c0101e');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(0, 0, 14, 12, 0, 0, 6.28); ctx.fill();
    // hood frill
    ctx.fillStyle = '#a00c1c'; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(-16, -16); ctx.lineTo(-8, -4); ctx.fill(); ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(-16, 16); ctx.lineTo(-8, 4); ctx.fill();
    // jaw / fangs
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(8, 6); ctx.lineTo(13, 13); ctx.lineTo(6, 10); ctx.fill(); ctx.beginPath(); ctx.moveTo(11, 2); ctx.lineTo(15, 8); ctx.lineTo(9, 6); ctx.fill();
    // tongue flick on beat
    if (QA.onBeat()) { ctx.strokeStyle = C.rage; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(12, 8); ctx.lineTo(20, 9); ctx.lineTo(24, 6); ctx.moveTo(20, 9); ctx.lineTo(24, 12); ctx.stroke(); }
    // glowing eyes
    ctx.fillStyle = C.toxic; ctx.shadowColor = C.toxic; ctx.shadowBlur = 8; ctx.fillRect(2, -5, 4, 4); ctx.shadowBlur = 0; ctx.fillStyle = '#1a0004'; ctx.fillRect(3, -4, 2, 2);
    ctx.restore();
    // crown of broken speakers (weak point) — pulses, flares ON the beat
    const onb = QA.onBeat(), cp = 0.5 + Math.sin(b.t * 4) * 0.5;
    ctx.shadowColor = onb ? C.gold : C.rageSoft; ctx.shadowBlur = (onb ? 16 : 8) + cp * 8;
    ctx.fillStyle = onb ? C.gold : '#d6a020';
    ctx.beginPath(); ctx.moveTo(14, 4); ctx.lineTo(20, -10); ctx.lineTo(28, 4); ctx.lineTo(36, -10); ctx.lineTo(44, 4); ctx.lineTo(52, -10); ctx.lineTo(58, 4); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#2a1e00';
    ctx.beginPath(); ctx.arc(24, -2, 2.5, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(40, -2, 2.5, 0, 6.28); ctx.fill();
    if (onb) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = C.toxic; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(18, -6); ctx.lineTo(26, -12); ctx.lineTo(34, -4); ctx.lineTo(44, -12); ctx.lineTo(50, -5); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  function drawPrincess() {
    const pr = princess; pr.t += 0.04;
    ctx.save(); ctx.translate(pr.x, pr.y);
    const g = ctx.createLinearGradient(0, 0, 50, 0); g.addColorStop(0, '#3a3a4a'); g.addColorStop(1, '#2a2a38');
    ctx.fillStyle = g; ctx.fillRect(-16, -46, 50, 180);
    ctx.fillStyle = '#4a4a5c'; ctx.fillRect(-16, -46, 50, 5);
    ctx.strokeStyle = '#22222e'; ctx.lineWidth = 1; for (let y = -40; y < 130; y += 12) { ctx.beginPath(); ctx.moveTo(-16, y); ctx.lineTo(34, y); ctx.stroke(); }
    ctx.fillStyle = win ? C.slime : '#0d0810'; if (win) { ctx.shadowColor = C.slime; ctx.shadowBlur = 16; }
    ctx.beginPath(); ctx.moveTo(-6, 30); ctx.lineTo(-6, 6); ctx.arc(3, 6, 9, Math.PI, 0); ctx.lineTo(12, 30); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.shadowColor = C.purple; ctx.shadowBlur = 10;
    ctx.fillStyle = C.purple; ctx.beginPath(); ctx.moveTo(-2, 30); ctx.lineTo(8, 30); ctx.lineTo(6, 14); ctx.lineTo(0, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0c4dc'; ctx.beginPath(); ctx.arc(3, 9, 4, 0, 6.28); ctx.fill();
    ctx.fillStyle = C.hair; ctx.fillRect(-1, 5, 8, 3);
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(2, 0); ctx.lineTo(3, 3); ctx.lineTo(4, 0); ctx.lineTo(6, 4); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = rageOn ? C.rage : C.slime; ctx.beginPath(); ctx.moveTo(-16, -46); ctx.lineTo(-16, -58); ctx.lineTo(-8, -50); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawParticles() {
    for (const pt of particles) {
      const a = Math.max(0, pt.life / pt.max);
      if (pt.shape === 'ring') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.7; ctx.strokeStyle = pt.col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, 6.28); ctx.stroke(); ctx.restore(); continue; }
      if (pt.shape === 'puddle') { ctx.save(); ctx.globalAlpha = a * 0.5; ctx.fillStyle = pt.col; ctx.beginPath(); ctx.ellipse(pt.x, pt.y, pt.size + (1 - a) * 3, pt.size * 0.4, 0, 0, 6.28); ctx.fill(); ctx.restore(); continue; }
      if (pt.glow) {
        // glow = a faint oversized pass underneath instead of per-particle shadowBlur
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = pt.col; ctx.globalAlpha = a * 0.35;
        if (pt.shape === 'goo') { ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (0.6 + a * 0.6) + 2.5, 0, 6.28); ctx.fill(); }
        else ctx.fillRect(pt.x - 2, pt.y - 2, pt.size + 4, pt.size + 4);
      }
      ctx.globalAlpha = a; ctx.fillStyle = pt.col;
      if (pt.shape === 'goo') { ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (0.6 + a * 0.6), 0, 6.28); ctx.fill(); }
      else ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }
  function drawFloaters() {
    ctx.save(); ctx.font = 'bold 8px "Courier New",monospace'; ctx.textAlign = 'center';
    for (const f of floaters) { const a = Math.max(0, f.life / f.max); ctx.globalAlpha = a; ctx.fillStyle = f.col; ctx.shadowColor = f.col; ctx.shadowBlur = 6; ctx.fillText(f.txt, f.x, f.y); }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.textAlign = 'left'; ctx.restore();
  }
  function drawPausedOverlay() {
    ctx.fillStyle = 'rgba(3,8,4,.8)'; ctx.fillRect(0, 0, W, VH);
    ctx.textAlign = 'center';
    const py = Math.max(0, (VH - H) * 0.5);   // keep the help card centered as the view grows
    ctx.fillStyle = C.slime; ctx.shadowColor = C.slime; ctx.shadowBlur = 12; ctx.font = 'bold 22px "Courier New",monospace';
    ctx.fillText('PAUSED', W / 2, py + 64); ctx.shadowBlur = 0;
    // an at-a-glance controls card so help is always one keypress away mid-run
    ctx.fillStyle = C.toxic; ctx.font = 'bold 9px "Courier New",monospace';
    ctx.fillText('— HOW TO PLAY —', W / 2, py + 92);
    const rows = [
      ['MOVE', 'A / D  ·  ← →'],
      ['JUMP', 'W / SPACE  (hold = higher)'],
      ['STOMP', 'jump onto a beast'],
      ['MIC BLAST', 'J'],
      ['SLIME DASH', 'K'],
      ['RAGE MODE', 'R  (when meter is full)'],
    ];
    ctx.font = '10px "Courier New",monospace';
    let y = py + 116;
    for (const [k, v] of rows) {
      ctx.textAlign = 'right'; ctx.fillStyle = C.slime; ctx.fillText(k, W / 2 - 8, y);
      ctx.textAlign = 'left'; ctx.fillStyle = '#cfe7bd'; ctx.fillText(v, W / 2 + 8, y);
      y += 17;
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#8fc680'; ctx.font = '9px "Courier New",monospace';
    ctx.fillText('jump ON the beat ✦ for a higher BEAT JUMP', W / 2, y + 6);
    ctx.fillStyle = C.gold; ctx.fillText('press P  or  MENU  to resume', W / 2, y + 22);
    ctx.textAlign = 'left';
  }

  /* ===================== HUD ===================== */
  let vizBars = [];
  function buildHud() {
    if (el.hearts) el.hearts.innerHTML = '';
    if (el.viz) { el.viz.innerHTML = ''; vizBars = []; for (let i = 0; i < 18; i++) { const s = document.createElement('i'); el.viz.appendChild(s); vizBars.push(s); } }
    buildHearts();
  }
  function buildHearts() { if (!el.hearts) return; el.hearts.innerHTML = ''; for (let i = 0; i < maxHp; i++) { const d = document.createElement('div'); d.className = 'q-heart'; el.hearts.appendChild(d); } }
  /* a live objective line under the zone name so a new player always knows the
     next step — defeat beasts → grab the key → reach the castle → fell the king. */
  function updateObjective() {
    if (!el.sub) return;
    let txt;
    if (state === 'win') txt = 'THE BEAT IS RESTORED ★';
    else if (boss) txt = '▶ STRIKE THE CROWN ON BEAT';
    else if (keysGot >= 1) txt = '▶ TO STATIC CASTLE →';
    else if (keyUp) txt = '▶ GRAB THE SLIME KEY';
    else txt = 'DEFEAT THE BEASTS · ' + Math.min(kills, 5) + '/5';
    if (el.sub.textContent !== txt) el.sub.textContent = txt;
  }
  function updateHUD(bs) {
    updateObjective();
    if (el.hearts) { const hs = el.hearts.children; for (let i = 0; i < hs.length; i++) hs[i].className = 'q-heart' + (i < hp ? '' : ' empty'); }
    if (el.coins) el.coins.textContent = score;
    if (el.keys) el.keys.textContent = keysGot;
    if (el.ragefill) el.ragefill.style.width = rage + '%';
    if (el.ragebl) el.ragebl.classList.toggle('rage-ready', rage >= 100);
    for (let i = 0; i < vizBars.length; i++) {
      const lvl = QA.live() ? QA.band(i, vizBars.length) : (Math.sin(timeNow * 0.012 + i * 0.6) * 0.5 + 0.5) * bs;
      const h = 4 + lvl * 30 + Math.random() * bs * 4;
      const b = vizBars[i]; b.style.height = h + 'px'; b.style.background = rageOn ? C.rage : C.slime; b.style.boxShadow = '0 0 6px ' + (rageOn ? C.rage : C.slime);
    }
  }
  function drawBossBar() {
    if (!boss || state !== 'play') return;
    const bw = 220, bx = (W - bw) / 2, by = VH - 22;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx - 3, by - 3, bw + 6, 12);
    ctx.fillStyle = '#2a0008'; ctx.fillRect(bx, by, bw, 7);
    ctx.fillStyle = C.rage; ctx.shadowColor = C.rage; ctx.shadowBlur = 8; ctx.fillRect(bx, by, bw * (boss.hp / boss.maxHp), 7); ctx.shadowBlur = 0;
    ctx.fillStyle = C.toxic; ctx.font = '8px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText('RED SERPENT KING — PHASE ' + boss.phase, W / 2, by - 5); ctx.textAlign = 'left';
  }

  /* ===================== responsive layout ===================== */
  /* Match the canvas buffer to the cabinet's real on-screen aspect (square pixels, no
     stretch) and re-anchor the world so the ground sits ~64% down. Also publishes the
     live control-deck height as --q-deckh so the CSS can dock the music bar + reserve the
     exact bottom space, leaving no black void anywhere on mobile. */
  function fitCanvas() {
    if (!cv || !ctx) return;
    const r = cv.getBoundingClientRect();
    let vh = H;
    if (r.width > 4 && r.height > 4) vh = Math.round(W * r.height / r.width);
    if (Math.abs(vh - H) <= 6) vh = H;                 // snap near-16:9 (desktop) to the exact base
    vh = Math.max(H, Math.min(vh, 900));               // never below 16:9; capped for sanity
    VOFF = Math.max(0, Math.round(vh * 0.64 - GY));    // place the ground line ~64% down
    WB = vh - VOFF;                                    // world-space bottom (ground + pits fill to here)
    if (cv.height !== vh) { cv.height = vh; cv.width = W; }
    VH = vh; ctx.imageSmoothingEnabled = false;
  }
  function relayout() {
    relayoutQueued = false;
    if (!root || !cv) return;
    if (el.deck) { const dh = Math.round(el.deck.getBoundingClientRect().height); document.documentElement.style.setProperty('--q-deckh', (dh || 0) + 'px'); }
    fitCanvas();
  }
  function scheduleRelayout() { if (relayoutQueued) return; relayoutQueued = true; requestAnimationFrame(relayout); }

  /* ===================== loop / state ===================== */
  let running = false, rafId = 0, lastFrame = 0;
  function loop(ts) {
    if (!running) return;
    if (!cv || !document.body.contains(cv)) { unmount(); return; }   // navigated away → self-clean
    const dt = Math.min(50, ts - (lastFrame || ts)); lastFrame = ts;
    update(dt); draw();
    rafId = requestAnimationFrame(loop);
  }
  function startGame() {
    QA.ensure(); QA.start();    // start the SB site track as the soundtrack (user gesture)
    reset(); state = 'play';
    ['title', 'over', 'win'].forEach(id => el[id] && el[id].classList.add('hidden'));
    el.cabinet && el.cabinet.classList.add('playing');
    setPlayingChrome(true);
    buildHud(); updateHUD(0);
  }
  function gameOver() {
    state = 'over'; rageOn = false; setPlayingChrome(false);
    el.cabinet && el.cabinet.classList.remove('playing');
    if (el.overscore) el.overscore.textContent = 'SLIME COINS: ' + score + '  ·  BEASTS FELLED: ' + kills + '  ·  BEST COMBO: x' + Math.max(bestCombo, combo);
    el.over && el.over.classList.remove('hidden');
  }
  function winGame() {
    if (state === 'win') return; state = 'win'; win = true; rageOn = false; setPlayingChrome(false); el.cabinet && el.cabinet.classList.remove('playing');
    shake = 14; flash = 12; burst(boss.x + boss.w / 2, boss.y, C.slime, 48, 5, { glow: 1 });
    if (el.fscore) el.fscore.textContent = 'SLIME COINS: ' + score + '  ·  BEST COMBO: x' + Math.max(bestCombo, combo) + '  ·  KINGDOM RESTORED';
    setTimeout(() => { el.win && el.win.classList.remove('hidden'); }, 950);
  }
  function togglePause() { if (state === 'play') state = 'paused'; else if (state === 'paused') state = 'play'; }

  /* ===================== mount / unmount ===================== */
  function wireScreens() {
    el.startbtn && (el.startbtn.onclick = startGame);
    el.retrybtn && (el.retrybtn.onclick = startGame);
    el.replaybtn && (el.replaybtn.onclick = startGame);
    el.pausebtn && (el.pausebtn.onclick = togglePause);
    // win-screen links → real site pages (client-side router picks these up)
    root.querySelectorAll('.q-wbtn[data-link]').forEach(btn => {
      btn.onclick = () => {
        const t = btn.dataset.link;
        // use the site's client-side router when present so the music keeps playing
        // across the hop; fall back to a hard load if app.js isn't on the page.
        const go = (u) => { if (typeof window.sbNavigate === 'function') window.sbNavigate(u, true); else location.href = u; };
        if (t === 'listen') { QA.start(); go('music.html'); }
        else if (t === 'vault') go('vault.html');
      };
    });
  }
  function mount(r) {
    if (!r) return;
    root = r;
    cv = q('qGame'); if (!cv) return;
    ctx = cv.getContext('2d'); cv.width = W; cv.height = H; ctx.imageSmoothingEnabled = false;
    VH = H; VOFF = 0; WB = H;
    el = {
      cabinet: q('qCabinet'), deck: q('qDeck'),
      hearts: q('qHearts'), viz: q('qViz'), coins: q('qCoins'), keys: q('qKeys'),
      lvlname: q('qLvlname'), sub: r.querySelector('.q-sub'),
      ragefill: q('qRagefill'), ragebl: r.querySelector('.q-hud-bl'),
      combo: q('qCombo'), dlg: q('qDlg'), dlgwho: q('qDlgwho'), dlgtxt: q('qDlgtxt'),
      title: q('qTitle'), over: q('qOver'), win: q('qWin'), fscore: q('qFscore'), overscore: q('qOverScore'),
      startbtn: q('qStart'), retrybtn: q('qRetry'), replaybtn: q('qReplay'), pausebtn: q('qPause'),
    };
    // reveal the touch control deck on coarse pointers (CSS keys off this class)
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) root.classList.add('q-has-touch');
    // tear down a prior mount's listeners/observer if mount() is re-entered without an
    // intervening unmount() (router re-entry) — otherwise the old AbortController + ResizeObserver leak.
    if (inputAC) { try { inputAC.abort(); } catch (_) { } }
    if (ro) { try { ro.disconnect(); } catch (_) { } ro = null; }
    bindInputs();
    bindTouch(q('qtL'), () => K.l = true, () => K.l = false);
    bindTouch(q('qtR'), () => K.r = true, () => K.r = false);
    bindTouch(q('qtU'), () => { K.jump = true; K.jumpEdge = true; }, () => K.jump = false);  // d-pad up → jump
    bindTouch(q('qtJ'), () => { K.jump = true; K.jumpEdge = true; }, () => K.jump = false);
    bindTouch(q('qtA'), () => { K.atk = true; K.atkEdge = true; }, () => K.atk = false);
    bindTouch(q('qtD'), () => { K.dash = true; K.dashEdge = true; }, () => K.dash = false);
    bindTouch(q('qtRG'), () => { K.rage = true; K.rageEdge = true; }, () => K.rage = false);
    // system row: START/MENU begin the quest from a menu screen, or pause/resume mid-run
    const sysBtn = () => { if (state === 'play' || state === 'paused') togglePause(); else startGame(); };
    ['qtStart', 'qtMenu'].forEach(id => { const b = q(id); if (b) b.onclick = sysBtn; });
    wireScreens();
    // size the canvas to the cabinet + keep it synced as the layout/orientation changes
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(scheduleRelayout);
      ro.observe(el.cabinet); if (el.deck) ro.observe(el.deck);
    }
    addEventListener('resize', scheduleRelayout, { signal: inputAC.signal });
    addEventListener('orientationchange', scheduleRelayout, { signal: inputAC.signal });
    relayout();
    // (re)start at the title screen
    state = 'title'; win = false;
    el.cabinet && el.cabinet.classList.remove('playing');
    el.title && el.title.classList.remove('hidden');
    el.over && el.over.classList.add('hidden');
    el.win && el.win.classList.add('hidden');
    reset(); buildHud(); updateHUD(0);
    if (!running) { running = true; lastFrame = 0; rafId = requestAnimationFrame(loop); }
    window.SBQuest._mounted = true;
  }
  function unmount() {
    running = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0;
    setPlayingChrome(false);
    if (ro) { try { ro.disconnect(); } catch (_) { } ro = null; }
    try { document.documentElement.style.removeProperty('--q-deckh'); } catch (_) { }
    if (inputAC) { try { inputAC.abort(); } catch (_) { } inputAC = null; }
    held = {}; for (const k in K) if (typeof K[k] === 'boolean') K[k] = false;
    window.SBQuest._mounted = false;
  }

  window.SBQuest = { mount, unmount, _mounted: false };
})();
