/* ============================================================
   SLIME, THEY NEED YOU! — headless gameplay simulation
   No browser needed: a stub DOM + no-op canvas runs the REAL
   engine (assets/quest.js) and verifies the run is beatable —
   gates open, DJ STATIC and the Red Serpent King actually die,
   the key drops, and the win screen is reached.
   Run with:  npm run test:quest
   ============================================================ */
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- stub DOM ---------- */
const gradient = { addColorStop() { } };
function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      return (...a) => (String(p).startsWith('create') ? gradient : undefined);
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
function makeClassList() {
  const s = new Set();
  return {
    add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)),
    toggle: (c, f) => { (f === undefined ? !s.has(c) : f) ? s.add(c) : s.delete(c); },
    contains: c => s.has(c),
  };
}
function makeEl(tag, id) {
  const el = {
    tag, id: id || '', children: [], dataset: {}, parentElement: null, onclick: null,
    textContent: '', className: '',
    classList: makeClassList(),
    style: { setProperty() { }, removeProperty() { } },
    addEventListener() { }, removeEventListener() { },
    appendChild(c) { c.parentElement = el; el.children.push(c); return c; },
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 0, height: 0 }),
  };
  Object.defineProperty(el, 'innerHTML', { get: () => '', set() { el.children = []; } });
  if (tag === 'canvas') {
    el.width = 0; el.height = 0;
    el.getContext = () => makeCtx();
    el.getBoundingClientRect = () => ({ width: 1024, height: 576 });
  }
  return el;
}
const IDS = ['qGame', 'qCabinet', 'qDeck', 'qHearts', 'qViz', 'qCoins', 'qKeys', 'qLvlname', 'qRagefill',
  'qCombo', 'qDlg', 'qDlgwho', 'qDlgtxt', 'qTitle', 'qOver', 'qWin', 'qFscore', 'qOverScore',
  'qStart', 'qRetry', 'qReplay', 'qPause', 'qBest', 'qtD', 'qtRG', 'qtU', 'qtL', 'qtR', 'qtA', 'qtJ', 'qtMenu', 'qtStart'];
const byId = {};
for (const id of IDS) byId[id] = makeEl(id === 'qGame' ? 'canvas' : 'div', id);
const subEl = makeEl('div'), hudblEl = makeEl('div');
const root = makeEl('div', 'qRoot');
root.querySelector = sel => {
  if (sel.startsWith('#')) return byId[sel.slice(1)] || null;
  if (sel === '.q-sub') return subEl;
  if (sel === '.q-hud-bl') return hudblEl;
  return null;
};

/* global listeners with AbortSignal support (quest binds key/blur on the global) */
const listeners = {};
globalThis.window = globalThis;
globalThis.addEventListener = (type, fn, opts = {}) => {
  (listeners[type] ||= []).push(fn);
  if (opts.signal) opts.signal.addEventListener('abort', () => {
    const a = listeners[type]; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  });
};
globalThis.removeEventListener = () => { };
function fire(type, props) {
  const e = Object.assign({ preventDefault() { }, stopPropagation() { } }, props);
  for (const fn of [...(listeners[type] || [])]) fn(e);
}
globalThis.document = {
  hidden: false,
  createElement: tag => makeEl(tag),
  body: { contains: () => true, classList: makeClassList() },
  documentElement: { className: '', style: { setProperty() { }, removeProperty() { } } },
  addEventListener() { }, removeEventListener() { },
};
let rafCb = null;
globalThis.requestAnimationFrame = cb => { rafCb = cb; return 1; };
globalThis.cancelAnimationFrame = () => { rafCb = null; };
// Node 20 has no global `navigator` (Node 21+ does) — stub it for the touch checks
if (!globalThis.navigator) Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });

/* ---------- load the real engine ---------- */
const code = await readFile(join(ROOT, 'assets', 'quest.js'), 'utf8');
(0, eval)(code);
const Q = globalThis.SBQuest;
if (!Q) { console.error('❌ SBQuest failed to define'); process.exit(1); }

/* ---------- helpers ---------- */
let ts = 0;
function frames(n) { for (let i = 0; i < n; i++) { const cb = rafCb; rafCb = null; ts += 16.7; if (cb) cb(ts); } }
function key(code, down) { fire(down ? 'keydown' : 'keyup', { code, key: '' }); }
function tap(code) { key(code, true); frames(1); key(code, false); }
const D = () => Q._debug();

const results = [];
const check = (name, ok, extra = '') => {
  results.push(!!ok);
  console.log((ok ? '  ✅' : '  ❌'), name, ok ? '' : ('— ' + extra));
};
const group = n => console.log('\n• ' + n);

/* ============================================================ */
group('mount + title + start');
Q.mount(root);
frames(5);
check('mounts into the stub DOM at the title screen', D().state === 'title', 'state=' + D().state);
tap('Enter');
frames(5);
check('Enter starts a run', D().state === 'play', 'state=' + D().state);
check('player spawns at the start', D().player.x < 200, 'x=' + D().player.x);

group('movement + double jump');
{
  key('KeyD', true); frames(30); key('KeyD', false);
  check('player moves right', D().player.x > 80, 'x=' + D().player.x);
  // ground jump…
  key('Space', true); frames(6);
  const vAir = D().player.vy;
  key('Space', false); frames(8);
  // …then a second press mid-air = double jump
  key('Space', true); frames(2); key('Space', false);
  const d = D();
  check('ground jump leaves the floor', vAir < 0, 'vy=' + vAir);
  check('double jump re-launches mid-air', d.player.airJumps === 0 && d.player.vy < -4, 'airJumps=' + d.player.airJumps + ' vy=' + d.player.vy);
  frames(60); // settle back to the ground
}

group('combat: mic blast kills a beast');
{
  const d = D();
  const mite = d.enemies.find(e => e.type === 'mite' && !e.dead);
  d.player.x = mite.x - 80; d.player.dir = 1; d.player.vx = 0;
  const before = D().kills;
  for (let i = 0; i < 6 && D().kills === before; i++) { tap('KeyJ'); frames(25); }
  check('a mite dies to the blast', D().kills > before, 'kills=' + D().kills);
}

group('gate 1: slime barrier');
{
  const d = D();
  d.setKills(0);
  d.player.x = 1640; d.player.vx = 0;
  key('KeyD', true); frames(40); key('KeyD', false);
  check('barrier blocks at <5 kills', D().player.x + D().player.w <= 1701, 'x=' + D().player.x);
  D().setKills(5); frames(3);
  check('barrier opens at 5 kills', D().gates[0].open === true);
  // walk through the gate line but stop short of the zone pit at 1750
  key('KeyD', true); frames(16); key('KeyD', false);
  check('player passes the opened gate', D().player.x > 1700, 'x=' + D().player.x);
}

group('boss 1: DJ STATIC is killable and drops the key');
{
  const d = D();
  d.player.x = 3030; d.player.y = 188; d.player.vy = 0;
  frames(3);
  check('DJ STATIC spawns past the swamp', !!D().mb, 'mb=' + !!D().mb);
  const hp0 = D().mb.hp;
  // stomp once: drop onto the cabinet from above
  const p = D().player, b = D().mb;
  p.x = b.x + 10; p.y = b.y - 50; p.vy = 3;
  frames(2);
  check('stomping damages the midboss', D().mb.hp < hp0, 'hp=' + D().mb.hp);
  // then blast him down from range until he folds
  let guard = 4000;
  while (!D().mbDead && guard-- > 0) {
    const dd = D();
    dd.player.x = Math.max(3060, dd.mb.x - 90); dd.player.y = 188; dd.player.vy = 0; dd.player.dir = 1;
    if (dd.hp < 4) dd.player.inv = 200;       // sim isn't dodging; keep it alive to test damage flow
    tap('KeyJ'); frames(20);
  }
  check('DJ STATIC dies to sustained blasts', D().mbDead, 'guard=' + guard);
  frames(80);   // let the death slow-mo fully play out before timing-sensitive checks
  check('the SLIME KEY drops on his defeat', !!D().theKey, 'key=' + JSON.stringify(D().theKey));
  check('power-ups drop with the key', D().pickups.length >= 1, 'n=' + D().pickups.length);
  const dd = D();
  dd.player.x = dd.theKey.x - 5; dd.player.y = dd.theKey.y - 10; frames(3);
  check('key collected on touch', D().keysGot === 1, 'keysGot=' + D().keysGot);
  check('castle gate opens with the key', D().gates[1].open === true);
}

group('boss 2: the Red Serpent King is killable');
{
  const d = D();
  d.player.x = 4705; d.player.y = 188; d.player.vy = 0; d.player.inv = 0;
  frames(3);
  check('the king rises in the throne room', !!D().boss, 'boss=' + !!D().boss);
  const hp0 = D().boss.hp;
  check('king has the rebalanced 30 HP', hp0 === 30, 'hp=' + hp0);
  // body shots now connect — no more crown-only pixel hunting
  let dd = D();
  dd.player.x = dd.boss.x - 90; dd.player.y = 188; dd.player.vy = 0; dd.player.dir = 1;
  tap('KeyJ'); frames(40);
  check('a body blast from the ground damages the king', D().boss.hp < hp0, 'hp=' + D().boss.hp);
  // stomp the king
  dd = D();
  const sh = dd.boss.hp;
  dd.player.x = dd.boss.x + 20; dd.player.y = dd.boss.y - 50; dd.player.vy = 3; dd.player.inv = 0;
  frames(6);
  check('stomping the king damages him', D().boss.hp < sh, 'hp=' + D().boss.hp);
  // grind him down ranged; the fight must END in a win
  let guard = 6000;
  while (D().state === 'play' && guard-- > 0) {
    dd = D();
    if (dd.boss && dd.boss.hp > 0) {
      dd.player.x = Math.max(4660, dd.boss.x - 95); dd.player.y = 188; dd.player.vy = 0; dd.player.dir = 1;
      dd.player.inv = 200;                      // survival is not under test here
      tap('KeyJ');
    }
    frames(18);
  }
  check('the king falls and the quest is WON', D().state === 'win', 'state=' + D().state + ' guard=' + guard);
  check('win banks the princess rescue', D().win === true);
}

group('checkpoints + continue');
{
  check('checkpoints advanced during the run', D().checkpoint >= 3, 'cp=' + D().checkpoint);
  // a fresh full run resets progress
  byId.qStart.onclick && byId.qStart.onclick();
  frames(3);
  const d = D();
  check('PLAY AGAIN starts a clean run', d.state === 'play' && d.checkpoint === 0 && d.kills === 0 && d.player.x < 200,
    'cp=' + d.checkpoint + ' kills=' + d.kills);
  // simulate a checkpoint death → continue resumes deep in the world
  d.setCheckpoint(2);
  byId.qRetry.onclick && byId.qRetry.onclick();
  frames(3);
  const d2 = D();
  check('CONTINUE respawns at the castle checkpoint', d2.player.x >= 3560 && d2.gates[0].open && d2.gates[1].open && d2.keysGot >= 1,
    'x=' + d2.player.x + ' g1=' + d2.gates[0].open + ' g2=' + d2.gates[1].open + ' keys=' + d2.keysGot);
}

group('continue after felling DJ STATIC without the key (regression: soft-lock)');
{
  // die between the arena and the castle gate: checkpoint 1, mid-boss dead, no key
  byId.qStart.onclick && byId.qStart.onclick();
  frames(3);
  let d = D();
  d.setCheckpoint(1); d.setMbDead(true); d.setKeysGot(0);
  byId.qRetry.onclick && byId.qRetry.onclick();
  frames(3);
  d = D();
  check('CONTINUE at checkpoint 1 lets DJ STATIC rise again', d.state === 'play' && d.mbDead === false && d.keysGot === 0 && d.checkpoint === 1,
    'mbDead=' + d.mbDead + ' keys=' + d.keysGot + ' cp=' + d.checkpoint);
  d.player.x = 3030; d.player.y = 188; d.player.vy = 0;
  frames(4);
  check('walking into the arena spawns him (so the key can drop)', !!D().mb, 'mb=' + !!D().mb);
  // …and a continue from the castle still skips him (key already banked)
  d = D(); d.setCheckpoint(2);
  byId.qRetry.onclick && byId.qRetry.onclick();
  frames(3);
  d = D();
  check('CONTINUE at the castle keeps him dead + the key banked', d.mbDead === true && d.keysGot >= 1, 'mbDead=' + d.mbDead + ' keys=' + d.keysGot);
}

group('one kill per beast (regression: TRIPLE MIC triple-counting)');
{
  byId.qStart.onclick && byId.qStart.onclick();
  frames(3);
  const d = D();
  const mite = d.enemies.find(e => e.type === 'mite' && !e.dead);
  check('a mite exists to shoot', !!mite);
  if (mite) {
    d.player.x = mite.x - 400; d.player.inv = 500;           // well away, invulnerable — the blasts are the test
    const k0 = d.kills;
    // three co-located blasts (what TRIPLE MIC fires at point-blank), parked so they sit on the mite after this frame's move
    for (let i = 0; i < 3; i++) d.blasts.push({ x: mite.x - 6, y: mite.y, w: 30, h: 22, dir: 1, vy: 0, life: 34, big: false, grew: 1 });
    frames(3);
    const dd = D();
    check('three blasts on one mite count ONE kill', mite.dead === true && dd.kills === k0 + 1, 'dead=' + mite.dead + ' kills ' + k0 + '→' + dd.kills);
  }
}

group('unmount');
Q.unmount();
check('unmount stops the loop', Q._mounted === false);

const fails = results.filter(r => !r).length;
console.log('\n' + (fails ? '❌ ' + fails + ' check(s) failed' : '✅ all ' + results.length + ' checks passed'));
process.exit(fails ? 1 : 0);
