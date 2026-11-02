/* ============================================================
   SB 3D — runtime core (ES module, loaded on demand by app.js).

   app.js injects <script type="module" src="assets/3d/core.js"> only when:
     · the page has a 3D mount point (hero / lab visualizer / music deck /
       SB World orbit) or a merch modal opens, and
     · the perf governor is NOT in lite mode, it isn't the admin preview, and
       the device isn't flagged save-data / very low memory.
   Old browsers that can't run modules never load it — the 2D site is untouched.

   One rAF loop drives every mounted scene. Each scene is culled while off
   screen, torn down when the client-side router swaps <main> (its host leaves
   the document), and everything unmounts if the governor flips to lite mid-visit
   (the `sb:lite` event) or a WebGL context is lost — the 2D canvases come back.
   ============================================================ */
import { IS_MOBILE, REDUCED } from './kit.js';

const MODULES = { hero: './hero.js', lab: './lab.js', vinyl: './vinyl.js', powers: './powers.js', merch: './merch.js' };
const TARGETS = {
  hero:   () => document.querySelector('main .hero'),
  lab:    () => document.querySelector('main #visualizer.viz'),
  vinyl:  () => document.querySelector('main #music .playerwin'),
  powers: () => document.querySelector('main #universe .upanels'),
};

/* ---------- shared state every scene reads ---------- */
const audio = {
  levels: new Float32Array(64), bass: 0, mid: 0, high: 0, energy: 0,
  beat: 0, beatHit: false, playing: false, _avg: 0, _last: -1e9,
};
const state = {
  audio, rage: 0, rageOn: false,
  lab: { on: false, rate: 1, rev: 0, room: 0.4 },
  pointer: { x: 0, y: 0 },
  reduced: REDUCED, mobile: IS_MOBILE,
  player: () => window.SBPlayer || null,
  site: () => window.SBSite || {},
};
addEventListener('pointermove', (e) => {
  state.pointer.x = (e.clientX / innerWidth) * 2 - 1;
  state.pointer.y = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

function avg(a, i0, i1) { let s = 0; for (let i = i0; i <= i1; i++) s += a[i] || 0; return s / (i1 - i0 + 1); }

/* Pull the live band levels the 2D visualizers already compute (app.js `levels`:
   64 smoothed bins, with a gentle idle "breath" when nothing is playing or the
   source is the cross-origin YouTube radio) plus rage + lab knobs. */
function readSite(tms, dt) {
  const P = window.SBPlayer;
  const lv = P && P.levels ? P.levels() : null;
  if (lv) for (let i = 0; i < 64; i++) audio.levels[i] = lv[i] || 0;
  const L = audio.levels;
  // fftSize 128 → each bin ≈ 344 Hz: bins 0–1 are the 808/kick, 2–12 the vocal body
  audio.bass = Math.max(L[0], L[1]) * 0.6 + avg(L, 0, 2) * 0.4;
  audio.mid = avg(L, 3, 14);
  audio.high = avg(L, 15, 40);
  audio.energy = avg(L, 0, 40);
  audio.playing = !!(P && P.isPlaying && P.isPlaying());
  // beat gate (same recipe as the 2D visualizers): an energy spike over its rolling
  // average, with a short refractory window. Bass bins sit near-saturated on rap
  // masters, so gating on them alone would barely ever fire.
  const kick = audio.energy * 0.6 + audio.bass * 0.4;
  audio._avg += (kick - audio._avg) * 0.06;
  audio.beatHit = false;
  if (audio.playing && kick > 0.12 && kick > audio._avg * 1.22 && tms - audio._last > 180) {
    audio._last = tms; audio.beat = 1; audio.beatHit = true;
  }
  audio.beat *= Math.pow(0.004, dt);
  state.rageOn = !!(P && P.rage && P.rage());
  state.rage += ((state.rageOn ? 1 : 0) - state.rage) * Math.min(1, dt * 2.5);
  if (P && P.lab) { const l = P.lab(); if (l) Object.assign(state.lab, l); }
}

/* ---------- scene registry + culling ---------- */
const scenes = new Map();
function updateBusy() {
  let busy = false;
  for (const s of scenes.values()) if (s.visible) busy = true;
  window.SB_3D_BUSY = busy;   // app.js throttles the full-page snake pit while a 3D scene is on screen
}
const io = new IntersectionObserver((es) => {
  for (const e of es) { const s = e.target.__sb3d; if (s) { s.visible = e.isIntersecting; s.dirty = true; } }
  updateBusy();
}, { rootMargin: '120px' });

const pending = new Map();   // kind → { host, promise } — one in-flight mount per kind + host
function mount(kind, host, opts) {
  const cur = scenes.get(kind);
  if (cur && cur.host === host && host.isConnected) return Promise.resolve(cur);
  const p = pending.get(kind);
  if (p && p.host === host) return p.promise;
  const promise = doMount(kind, host, opts).finally(() => { if (pending.get(kind) && pending.get(kind).promise === promise) pending.delete(kind); });
  pending.set(kind, { host, promise });
  return promise;
}
async function doMount(kind, host, opts) {
  const cur = scenes.get(kind);
  if (cur) { if (cur.host === host && host.isConnected) return cur; unmount(kind); }
  let mod;
  try { mod = await import(MODULES[kind]); } catch (e) { console.warn('[sb3d] load', kind, e); return null; }
  if (!host.isConnected || window.SB_LITE || scenes.has(kind)) return scenes.get(kind) || null;
  let s;
  try { s = await mod.create(host, state, opts || {}); }
  catch (e) { console.warn('[sb3d] create', kind, e); return null; }
  if (!s) return null;
  if (!host.isConnected || window.SB_LITE || (pending.get(kind) && pending.get(kind).host !== host)) { safeDispose(s); return null; }   // superseded while it built
  if (scenes.has(kind)) unmount(kind);
  s.kind = kind; s.host = host; s.visible = false; s.dirty = true;
  scenes.set(kind, s);
  const watch = s.watchEl || host; watch.__sb3d = s; io.observe(watch);
  const sizeEl = s.sizeEl || host;
  const fit = () => { const r = sizeEl.getBoundingClientRect(); if (r.width > 1 && r.height > 1) { s.resize(r.width, r.height); s.dirty = true; } };
  s._ro = new ResizeObserver(fit); s._ro.observe(sizeEl); fit();
  if (s.canvas) s.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); unmount(kind); }, { once: true });
  ensureLoop();
  return s;
}
function safeDispose(s) {
  try { s.dispose(); } catch (e) { console.warn('[sb3d] dispose', s.kind, e); }
  if (s.renderer) { try { s.renderer.dispose(); s.renderer.forceContextLoss(); } catch (_) {} }
}
function unmount(kind) {
  const s = scenes.get(kind); if (!s) return;
  scenes.delete(kind);
  try { io.unobserve(s.watchEl || s.host); } catch (_) {}
  try { if (s._ro) s._ro.disconnect(); } catch (_) {}
  safeDispose(s);
  updateBusy();
  try { const site = window.SBSite; if (site && site.resizeAll) site.resizeAll(); } catch (_) {}
}

/* ---------- the loop ---------- */
let raf = 0, last = 0;
function loop(t) {
  raf = requestAnimationFrame(loop);
  if (last && t - last < 14) return;                  // ~60fps cap (high-refresh panels otherwise double the work)
  const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
  last = t;
  readSite(t, dt);
  /* a modal (lore card, clip preview, merch…) covers the page with an opaque blurred
     backdrop — don't burn GPU on scenes nobody can see behind it */
  let modalUp = false; try { modalUp = !!(window.SBSite && window.SBSite.modalOpen()); } catch (_) {}
  for (const [kind, s] of scenes) {
    if (!s.host.isConnected || (s.alive && !s.alive())) { unmount(kind); continue; }
    if (modalUp && !s.overModal) { s.dirty = true; continue; }
    if (!s.visible && !s.force) continue;
    if (state.reduced && !audio.playing && !s.dirty && !s.force) continue;   // reduced motion: still unless music plays
    try { s.update(t / 1000, dt, state); s.dirty = false; }
    catch (e) { console.warn('[sb3d] frame', kind, e); unmount(kind); }
  }
  if (!scenes.size) { cancelAnimationFrame(raf); raf = 0; last = 0; }
}
function ensureLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }

/* ---------- public API (window.SB3D) ---------- */
export async function mountPage() {
  for (const [k, s] of scenes) if (!s.host.isConnected) unmount(k);
  if (window.SB_LITE) return;
  const jobs = [];
  for (const k of Object.keys(TARGETS)) { const h = TARGETS[k](); if (h) jobs.push(mount(k, h)); }
  await Promise.all(jobs);
}
export function mountMerch(host, data) { return window.SB_LITE ? Promise.resolve(null) : mount('merch', host, data); }
export function unmountAll() { for (const k of [...scenes.keys()]) unmount(k); }
export function get(kind) { return scenes.get(kind) || null; }

document.addEventListener('sb:lite', (e) => { if (e.detail && e.detail.on) unmountAll(); });

window.SB3D = { mountPage, mountMerch, unmountAll, get, state };
