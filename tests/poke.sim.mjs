/* ============================================================
   SLIMÉMON — headless gameplay simulation
   No browser needed: a stub DOM + no-op canvas runs the REAL
   engine (assets/monsters.js) and verifies the game actually
   works — the type chart, damage + catch math, a wild battle
   won, a catch, level-up/evolution, a trainer + the gym badge,
   and a save/continue round-trip.
   Run with:  npm run test:poke
   ============================================================ */
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- stub DOM ---------- */
const gradient = { addColorStop() { } };
function makeCtx() {
  return new Proxy({}, {
    get(t, p) { if (p in t) return t[p]; return (...a) => (String(p).startsWith('create') ? gradient : undefined); },
    set(t, p, v) { t[p] = v; return true; },
  });
}
function makeClassList() {
  const s = new Set();
  return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), toggle: (c, f) => { (f === undefined ? !s.has(c) : f) ? s.add(c) : s.delete(c); }, contains: c => s.has(c) };
}
function makeEl(tag, id) {
  const el = {
    tag, id: id || '', children: [], dataset: {}, parentElement: null, onclick: null, textContent: '', className: '',
    classList: makeClassList(), style: { setProperty() { }, removeProperty() { } },
    addEventListener() { }, removeEventListener() { },
    appendChild(c) { c.parentElement = el; el.children.push(c); return c; },
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 0, height: 0 }),
  };
  Object.defineProperty(el, 'innerHTML', { get: () => '', set() { el.children = []; } });
  if (tag === 'canvas') { el.width = 0; el.height = 0; el.getContext = () => makeCtx(); el.getBoundingClientRect = () => ({ width: 720, height: 480 }); }
  return el;
}
const IDS = ['pkRoot', 'pkGame', 'pkCabinet', 'pkDeck', 'pkU', 'pkD', 'pkL', 'pkR', 'pkA', 'pkB', 'pkStart', 'pkSelect'];
const byId = {};
for (const id of IDS) byId[id] = makeEl(id === 'pkGame' ? 'canvas' : 'div', id);
byId.pkCabinet.getBoundingClientRect = () => ({ width: 720, height: 480 });
const root = byId.pkRoot;

/* global listeners with AbortSignal support */
const listeners = {};
globalThis.window = globalThis;
globalThis.addEventListener = (type, fn, opts = {}) => { (listeners[type] ||= []).push(fn); if (opts.signal) opts.signal.addEventListener('abort', () => { const a = listeners[type]; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }); };
globalThis.removeEventListener = () => { };
globalThis.document = {
  hidden: false, createElement: tag => makeEl(tag),
  getElementById: id => byId[id] || null,
  body: { contains: () => true, classList: makeClassList() },
  documentElement: { className: '', style: { setProperty() { }, removeProperty() { } } },
  addEventListener() { }, removeEventListener() { },
};
globalThis.requestAnimationFrame = () => 1;     // the sim drives frames itself via _debug.step()
globalThis.cancelAnimationFrame = () => { };
if (!globalThis.navigator) Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });

/* ---------- load the real engine ---------- */
const code = await readFile(join(ROOT, 'assets', 'monsters.js'), 'utf8');
(0, eval)(code);
const P = globalThis.SBPoke;
if (!P) { console.error('❌ SBPoke failed to define'); process.exit(1); }

/* ---------- harness ---------- */
const D = () => P._debug();
const step = (dt) => D().step(dt);
const press = (a) => { D().press(a); step(); };
const results = [];
const check = (name, ok, extra = '') => { results.push(!!ok); console.log((ok ? '  ✅' : '  ❌'), name, ok ? '' : ('— ' + extra)); };
const group = n => console.log('\n• ' + n);

function attack() { // one FIGHT → move0 → resolve, then flush messages
  if (!D().B || D().battlePhase() !== 'menu') return;
  press('a');           // FIGHT (menu cursor starts at 0)
  press('a');           // move slot 0
  D().flush();
}
function fightToEnd(maxTurns) {
  let g = maxTurns || 60;
  while (D().mode === 'battle' && g-- > 0) {
    if (D().battlePhase() === 'menu') attack();
    else { D().flush(); step(); }
  }
}

/* ============================================================ */
group('mount + title');
P.mount(root);
step(); step();
check('mounts at the title screen', D().mode === 'title', 'mode=' + D().mode);
D().srand(20260617);

group('new game');
press('a');                       // NEW GAME
check('new game drops into a dialog/field', D().mode === 'dialog' || D().mode === 'field', 'mode=' + D().mode);
D().flush();                      // clear intro text
check('player starts in their room', D().G && D().G.map === 'home', 'map=' + (D().G && D().G.map));
check('no starter yet', D().G.party.length === 0, 'n=' + D().G.party.length);

group('type chart (the 6 powers ring)');
const eff = D().eff, effMulti = D().effMulti;
check('SLIME is super effective vs SNAKE', eff('SLIME', 'SNAKE') === 2);
check('SNAKE resists SLIME', eff('SNAKE', 'SLIME') === 0.5);
check('NEON loops back super vs SLIME', eff('NEON', 'SLIME') === 2);
check('off-ring matchup is neutral', eff('SLIME', 'MOTION') === 1);
check('dual-type stacks multipliers', effMulti('SLIME', ['SNAKE', 'PRESSURE']) === 2 && effMulti('SLIME', ['NEON', 'SOUND']) === 0.5);

group('damage math');
D().srand(7);
const r1 = D().calcDamage(D().makeMon('venomba', 50), D().makeMon('scrat', 50), 'gnash');   // SNAKE vs MOTION = 2x
check('super-effective hit lands real damage', r1.dmg > 0 && r1.mult === 2, JSON.stringify(r1));
const r2 = D().calcDamage(D().makeMon('driplet', 30), D().makeMon('neonmoth', 30), 'slimeslap'); // SLIME vs NEON = 0.5x
check('resisted hit is marked 0.5x', r2.mult === 0.5, 'mult=' + r2.mult);
const r3 = D().calcDamage(D().makeMon('driplet', 10), D().makeMon('scrat', 10), 'dissolve');  // status move
check('status moves deal no direct damage', r3.dmg === 0, 'dmg=' + r3.dmg);

group('catch math');
const sleeper = D().makeMon('globlet', 5); sleeper.hp = 1; sleeper.status = 'slp';
let caughtLow = 0; D().srand(1); for (let i = 0; i < 40; i++) if (D().tryCatch(sleeper, 1.5).caught) caughtLow++;
check('a 1-HP sleeping target is usually caught', caughtLow >= 25, caughtLow + '/40');
check('the 808 ball never fails', D().tryCatch(D().makeMon('snagon', 50), 255).caught === true);

group('a wild battle, won');
D().giveMon('venomba', 30);                 // a strong partner → party[0]
D().srand(42);
D().startWild('scrat', 4);
D().flush();
check('a wild battle begins', D().mode === 'battle' && D().B.kind === 'wild');
const expBefore = D().G.party[0].exp;
fightToEnd();
check('the wild battle ends back on the field', D().mode === 'field', 'mode=' + D().mode);
check('the wild foe was logged in the dex', !!D().G.dexSeen['scrat']);
check('the active mon earned EXP', D().G.party[0].exp > expBefore, 'exp ' + expBefore + '→' + D().G.party[0].exp);

group('catching a wild mon (BAG → throw)');
const savedBag = Object.assign({}, D().G.bag);
D().G.bag = { eightball: 1 };               // a guaranteed ball, alone at bag slot 0
const partyN = D().G.party.length;
D().startWild('globlet', 5);
D().flush();
D().B.foe.hp = 1;
press('right');                              // menu: FIGHT → BAG
press('a');                                  // open BAG
check('the bag opens in battle', D().mode === 'bag', 'mode=' + D().mode);
press('a');                                  // throw the 808 ball (slot 0)
D().flush();
check('the catch ends the battle', D().mode === 'field', 'mode=' + D().mode);
check('the caught mon joined the team', D().G.party.length === partyN + 1, 'n=' + D().G.party.length);
check('the catch is recorded in the dex', !!D().G.dexCaught['globlet']);
D().G.bag = savedBag;

group('level-up + evolution');
const evoMon = D().makeMon('driplet', 15);
D().srand(3);
D().gainExp(evoMon, D().makeMon('snagon', 70), false);   // a big EXP haul pushes past Lv16
check('the mon levelled up', evoMon.lv >= 16, 'lv=' + evoMon.lv);
check('DRIPLET evolved into OOZARD at 16', evoMon.sp === 'oozard', 'sp=' + evoMon.sp);

group('trainer battle + the FANG BADGE');
const dbg = D();
dbg.G.party = [dbg.makeMon('gloopking', 60)];      // an overwhelming ace
const viper = dbg.npc('gym', 2);
check('the gym leader is VIPER', viper && viper.leader === true, 'name=' + (viper && viper.name));
D().srand(99);
dbg.startTrainer(viper);
D().flush();
check('a trainer battle begins', D().mode === 'battle' && D().B.kind === 'trainer');
fightToEnd(120);
check('the leader is beaten', viper.beaten === true);
check('the FANG BADGE was earned', D().G.badges >= 1, 'badges=' + D().G.badges);
check('prize money was paid', D().G.money > 1500, '$' + D().G.money);

group('save + continue round-trip');
const dbg2 = D();
dbg2.G.money = 4242;
const beforeParty = dbg2.G.party.map(m => m.sp + '@' + m.lv).join(',');
check('save writes', dbg2.saveGame() === true);
dbg2.G.money = 0; dbg2.G.party = [];
const ok = dbg2.continueGame();
check('continue loads the save', ok === true);
check('money restored', D().G.money === 4242, '$' + D().G.money);
check('party restored', D().G.party.map(m => m.sp + '@' + m.lv).join(',') === beforeParty, D().G.party.map(m => m.sp + '@' + m.lv).join(','));
check('beaten trainers persist', D().MAPS.gym.npcs[2].beaten === true);

group('cleanup');
P.unmount();
check('unmount stops cleanly', P._mounted === false);
D().del();

/* ---------- tally ---------- */
const passed = results.filter(Boolean).length, total = results.length;
console.log('\n' + (passed === total ? '✅' : '❌') + ' SLIMÉMON sim: ' + passed + '/' + total + ' checks passed');
process.exit(passed === total ? 0 : 1);
