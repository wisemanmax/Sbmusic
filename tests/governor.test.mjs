// Standalone verification of the adaptive performance governor (app.js).
// The browser download is blocked in this environment, so instead of a full
// e2e run we extract the REAL governor source from app.js and exercise its
// decision logic + FPS thresholds in a vm sandbox with mocked globals.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8').split('\n');
// Extract the governor block (sbSoftwareGPU / sbSetLite / boot IIFE / sbSampleFps) by content
// rather than hard-coded line numbers, so edits elsewhere in app.js can't silently shift it out
// of range: from `function sbSoftwareGPU()` to the column-0 closing brace of `sbSampleFps`.
const start = src.findIndex(l => /^function sbSoftwareGPU\(\)/.test(l));
const fpsIdx = src.findIndex((l, i) => i > start && /^function sbSampleFps\(/.test(l));
let end = fpsIdx;
while (end < src.length && src[end] !== '}') end++;   // sbSampleFps's own closing brace
const GOV = src.slice(start, end + 1).join('\n');
assert.ok(start >= 0 && fpsIdx > start && /function sbSoftwareGPU/.test(GOV) && /function sbSampleFps/.test(GOV), 'extracted wrong block');

function makeCtx({ search = '', stored = null, renderer = 'NVIDIA GeForce', webgl = true }) {
  const store = new Map();
  if (stored != null) store.set('sb_lite', stored);
  const classes = new Set();
  const fakeGL = {
    getExtension: (n) => n === 'WEBGL_debug_renderer_info'
      ? { UNMASKED_RENDERER_WEBGL: 37446 }
      : { loseContext() {} },
    getParameter: () => renderer,
  };
  const window = {};
  const ctx = {
    window,
    document: {
      createElement: () => ({ getContext: () => (webgl ? fakeGL : null) }),
      documentElement: { classList: { toggle: (n, on) => { on ? classes.add(n) : classes.delete(n); } } },
    },
    sessionStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    location: { search },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return { ctx, classes, store };
}

function run(opts) {
  const env = makeCtx(opts);
  vm.runInContext(GOV, env.ctx, { filename: 'governor.block.js' });
  return env;
}

let pass = 0;
const check = (name, cond) => { assert.ok(cond, name); console.log('  ✓', name); pass++; };

console.log('boot decision tree:');
check('software GPU (SwiftShader) → lite',
  run({ renderer: 'Google SwiftShader' }).ctx.window.SB_LITE === true);
check('software GPU (llvmpipe) → lite',
  run({ renderer: 'llvmpipe (LLVM 15)' }).ctx.window.SB_LITE === true);
check('no WebGL at all → lite',
  run({ webgl: false }).ctx.window.SB_LITE === true);
check('hardware GPU (NVIDIA) → NOT lite',
  !run({ renderer: 'NVIDIA GeForce RTX 4070' }).ctx.window.SB_LITE);
check('?lite forces lite even on good GPU',
  run({ search: '?lite', renderer: 'NVIDIA' }).ctx.window.SB_LITE === true);
{
  const e = run({ search: '?full', stored: '1', renderer: 'Google SwiftShader' });
  check('?full opts out + clears storage (even on software GPU)',
    !e.ctx.window.SB_LITE && !e.store.has('sb_lite'));
}
check('stored sb_lite=1 → lite (good GPU, sticky for the session)',
  run({ stored: '1', renderer: 'NVIDIA' }).ctx.window.SB_LITE === true);
check('?preview skips auto-detect (no lite on software GPU under admin preview)',
  !run({ search: '?preview', renderer: 'Google SwiftShader' }).ctx.window.SB_LITE);
check('lite boot persists sb_lite to sessionStorage',
  run({ renderer: 'SwiftShader' }).store.get('sb_lite') === '1');

console.log('frame-rate watchdog (good-GPU boot, then sample):');
function feedFps(deltaMs, frames) {
  const env = run({ renderer: 'NVIDIA' });            // boots NOT lite
  assert.ok(!env.ctx.window.SB_LITE, 'precondition: not lite after good-GPU boot');
  let t = 3000;                                       // past the 2.5s warm-up
  for (let i = 0; i < frames; i++) { env.ctx.sbSampleFps(t); t += deltaMs; }
  return env;
}
check('~30fps sustained → flips to lite',
  feedFps(1000 / 30, 260).ctx.window.SB_LITE === true);
check('~60fps sustained → stays full',
  !feedFps(1000 / 60, 400).ctx.window.SB_LITE);
check('~45fps borderline-good (avg ≈ 22.2 > 22) → flips',
  feedFps(1000 / 45, 260).ctx.window.SB_LITE === true);
check('~50fps (avg 20 < 22) → stays full',
  !feedFps(1000 / 50, 400).ctx.window.SB_LITE);
{
  // a single bad window then recovery must NOT flip (needs two consecutive bad windows)
  const env = run({ renderer: 'NVIDIA' });
  let t = 3000;
  for (let i = 0; i < 100; i++) { env.ctx.sbSampleFps(t); t += 1000 / 30; }  // 1 bad window
  for (let i = 0; i < 200; i++) { env.ctx.sbSampleFps(t); t += 1000 / 60; }  // recover
  check('one bad window + recovery → stays full', !env.ctx.window.SB_LITE);
}

console.log(`\nAll ${pass} governor checks passed.`);
